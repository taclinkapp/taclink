// Smoke test runner — audits the live app every 5 minutes (cron) or on demand (admin).
// Probes critical public routes, key edge functions, DB invariants. Auto-remediates
// safe known issues (stuck-expired deposits past grace window).
//
// Auth:
//   - cron sweep: header `x-cron-secret` must match CRON_SECRET env
//   - manual run: caller must be authenticated admin
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

// Public base URL of the live app (override with PUBLIC_APP_URL secret if needed).
const APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "https://taclink.app";

type Finding = {
  category: string;
  check_name: string;
  status: "pass" | "fail" | "warn";
  detail?: string;
  target?: string;
  auto_fixed?: boolean;
  fix_notes?: string;
};

const TIMEOUT = 10_000;

async function probeUrl(url: string, expect = 200): Promise<Finding> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { method: "GET", signal: ctrl.signal, redirect: "follow" });
    await res.text().catch(() => {});
    const ok = res.status === expect || (res.status >= 200 && res.status < 400);
    return {
      category: "route",
      check_name: `GET ${new URL(url).pathname}`,
      status: ok ? "pass" : "fail",
      detail: `HTTP ${res.status}`,
      target: url,
    };
  } catch (e) {
    return {
      category: "route",
      check_name: `GET ${url}`,
      status: "fail",
      detail: (e as Error).message,
      target: url,
    };
  } finally {
    clearTimeout(t);
  }
}

async function probeEdgeFn(name: string): Promise<Finding> {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      method: "OPTIONS",
      headers: { "access-control-request-method": "POST" },
      signal: ctrl.signal,
    });
    await res.text().catch(() => {});
    const ok = res.status >= 200 && res.status < 500;
    return {
      category: "edge_function",
      check_name: `OPTIONS ${name}`,
      status: ok ? "pass" : "fail",
      detail: `HTTP ${res.status}`,
      target: url,
    };
  } catch (e) {
    return {
      category: "edge_function",
      check_name: `OPTIONS ${name}`,
      status: "fail",
      detail: (e as Error).message,
      target: url,
    };
  } finally {
    clearTimeout(t);
  }
}

serve(async () => {});

async function dbChecks(admin: ReturnType<typeof createClient>): Promise<Finding[]> {
  const out: Finding[] = [];

  // Required tables exist + are queryable
  const requiredTables = [
    "profiles", "user_roles", "courses", "bookings",
    "smoke_test_runs", "subscription_plans", "issue_reports",
  ];
  for (const tbl of requiredTables) {
    const { error, count } = await admin.from(tbl).select("*", { count: "exact", head: true });
    out.push({
      category: "database",
      check_name: `table:${tbl}`,
      status: error ? "fail" : "pass",
      detail: error ? error.message : `${count ?? 0} rows`,
      target: tbl,
    });
  }

  // 404 hits last hour (warn if > 5)
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recent404 } = await admin
    .from("route_404_events")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since);
  out.push({
    category: "reliability",
    check_name: "404s last hour",
    status: (recent404 ?? 0) > 5 ? "warn" : "pass",
    detail: `${recent404 ?? 0} hits`,
  });

  return out;
}

async function autoRemediate(admin: ReturnType<typeof createClient>): Promise<Finding[]> {
  const out: Finding[] = [];

  // Stuck deposits: awaiting_confirmation and expired > 24h ago -> mark failed
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: stuck } = await admin
    .from("bookings")
    .select("id, deposit_expires_at")
    .eq("deposit_status", "awaiting_confirmation")
    .lt("deposit_expires_at", cutoff)
    .limit(50);

  if (stuck && stuck.length > 0) {
    const ids = stuck.map((b: any) => b.id);
    const { error } = await admin
      .from("bookings")
      .update({ deposit_status: "failed" })
      .in("id", ids);
    out.push({
      category: "auto_fix",
      check_name: "expired_stuck_deposits",
      status: error ? "fail" : "pass",
      detail: error ? error.message : `Marked ${ids.length} deposit(s) as failed`,
      auto_fixed: !error && ids.length > 0,
      fix_notes: error ? undefined : `Bookings: ${ids.slice(0, 5).join(", ")}${ids.length > 5 ? "…" : ""}`,
    });
  } else {
    out.push({
      category: "auto_fix",
      check_name: "expired_stuck_deposits",
      status: "pass",
      detail: "No stuck deposits past grace window",
    });
  }

  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Auth: cron secret OR admin user
  const cronHeader = req.headers.get("x-cron-secret") ?? "";
  let triggered_by: "cron" | "manual" = "cron";
  let triggered_by_user: string | null = null;

  if (!CRON_SECRET || cronHeader !== CRON_SECRET) {
    // Try user auth
    const authz = req.headers.get("Authorization") ?? "";
    if (!authz.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authz } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: user.id, _role: "admin",
    });
    if (!isAdmin) return json({ error: "forbidden" }, 403);
    triggered_by = "manual";
    triggered_by_user = user.id;
  }

  // Create run row
  const { data: runRow, error: runErr } = await admin
    .from("smoke_test_runs")
    .insert({ triggered_by, triggered_by_user, status: "running" })
    .select()
    .single();
  if (runErr || !runRow) return json({ error: "could_not_create_run", detail: runErr?.message }, 500);
  const runId = (runRow as any).id as string;

  const startedAt = Date.now();
  const findings: Finding[] = [];

  // Route probes
  const routes = [
    "/", "/auth/signin", "/auth/student-signup", "/auth/instructor-signup",
    "/student", "/admin/login", "/welcome",
  ];
  for (const r of routes) findings.push(await probeUrl(`${APP_URL}${r}`));

  // Edge function reachability
  const fns = [
    "uptime-runner", "admin-ai", "create-helcim-checkout",
    "verify-checkin-qr", "subscription-plan-ai", "ai-propose",
  ];
  for (const f of fns) findings.push(await probeEdgeFn(f));

  // DB checks
  findings.push(...(await dbChecks(admin)));

  // Auto-remediation
  findings.push(...(await autoRemediate(admin)));

  // Persist findings
  if (findings.length > 0) {
    await admin.from("smoke_test_findings").insert(
      findings.map((f) => ({ ...f, run_id: runId })),
    );
  }

  const passed = findings.filter((f) => f.status === "pass").length;
  const failed = findings.filter((f) => f.status === "fail").length;
  const auto_fixed = findings.filter((f) => f.auto_fixed).length;
  const status = failed > 0 ? "failed" : "passed";

  await admin
    .from("smoke_test_runs")
    .update({
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      status,
      total_checks: findings.length,
      passed,
      failed,
      auto_fixed,
      summary: { triggered_by },
    })
    .eq("id", runId);

  return json({ ok: true, run_id: runId, status, passed, failed, auto_fixed, total: findings.length });
});
