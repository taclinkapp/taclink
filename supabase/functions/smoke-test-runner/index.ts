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
    const body = await res.text().catch(() => "");
    const client404 = body.includes("We couldn't find the page you're looking for.") || body.includes("Page not found · TacLink");
    const ok = (res.status === expect || (res.status >= 200 && res.status < 400)) && !client404;
    return {
      category: "route",
      check_name: `GET ${new URL(url).pathname}`,
      status: ok ? "pass" : "fail",
      detail: client404 ? `HTTP ${res.status} but rendered client 404` : `HTTP ${res.status}`,
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

const CRITICAL_ONBOARDING_ROUTES = [
  "/", "/welcome", "/welcome/quiz", "/welcome/plan",
  "/student", "/instructor", "/auth/student-signup", "/auth/instructor-signup",
];

const LEGACY_ONBOARDING_PATHS = new Set([
  "/onboarding", "/onboarding/welcome", "/onboarding/quiz", "/onboarding/plan",
  "/onboarding/profile", "/onboarding/student", "/onboarding/instructor", "/onboarding/dashboard",
]);

async function onboardingReliabilityChecks(
  admin: ReturnType<typeof createClient>,
  routeFindings: Finding[],
): Promise<Finding[]> {
  const out: Finding[] = [];

  const failedCritical = routeFindings.filter((f) => {
    try {
      return CRITICAL_ONBOARDING_ROUTES.includes(new URL(f.target ?? "").pathname) && f.status === "fail";
    } catch {
      return false;
    }
  });
  out.push({
    category: "onboarding",
    check_name: "Audit onboarding redirects",
    status: failedCritical.length ? "fail" : "pass",
    detail: failedCritical.length
      ? `Broken onboarding/profile route(s): ${failedCritical.map((f) => f.target).join(", ")}`
      : `${CRITICAL_ONBOARDING_ROUTES.length} onboarding, auth, and role landing routes respond safely`,
    target: CRITICAL_ONBOARDING_ROUTES.join(","),
  });

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent404s, error: recent404Err } = await admin
    .from("route_404_events")
    .select("path, referrer, user_role, created_at")
    .gte("created_at", since24h)
    .order("created_at", { ascending: false })
    .limit(500);
  const legacyHits = ((recent404s ?? []) as Array<{ path: string; referrer: string | null }>).filter((row) => {
    const basePath = row.path.split("?")[0].split("#")[0];
    return LEGACY_ONBOARDING_PATHS.has(basePath);
  });
  out.push({
    category: "onboarding",
    check_name: "Fix unsafe onboarding navigation",
    status: recent404Err ? "fail" : legacyHits.length ? "fail" : "pass",
    detail: recent404Err
      ? recent404Err.message
      : legacyHits.length
        ? `Legacy onboarding route hits detected: ${legacyHits.slice(0, 5).map((h) => h.path).join(", ")}`
        : "No legacy onboarding paths or unsafe welcome-flow links hit 404 in the last 24h",
    target: Array.from(LEGACY_ONBOARDING_PATHS).join(","),
  });

  // Regression test: every onboarding route + every legacy /onboarding/* path
  // must resolve safely (HTTP 2xx/3xx — SPA fallback returns 200 + index.html).
  // This guards against future router edits that drop the legacy redirects.
  const regressionTargets = [
    ...CRITICAL_ONBOARDING_ROUTES,
    ...Array.from(LEGACY_ONBOARDING_PATHS),
  ];
  const regressionResults = await Promise.all(
    regressionTargets.map((p) => probeUrl(`${APP_URL}${p}`)),
  );
  const regressionFails = regressionResults.filter((r) => r.status === "fail");
  out.push({
    category: "onboarding",
    check_name: "Onboarding & legacy route regression",
    status: regressionFails.length ? "fail" : "pass",
    detail: regressionFails.length
      ? `Unsafe/404 routes: ${regressionFails.map((f) => f.target).join(", ")}`
      : `${regressionTargets.length} onboarding + legacy /onboarding/* paths resolve safely (no 404, no unsafe navigation)`,
    target: regressionTargets.join(","),
  });

  const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ error: routeErr, count: routeCount }, { error: resolutionErr, count: resolutionCount }] = await Promise.all([
    admin.from("route_404_events").select("*", { count: "exact", head: true }).gte("created_at", since1h),
    admin.from("route_404_resolutions").select("*", { count: "exact", head: true }),
  ]);
  out.push({
    category: "reliability",
    check_name: "Validate routing signals",
    status: routeErr || resolutionErr ? "fail" : "pass",
    detail: routeErr || resolutionErr
      ? (routeErr?.message ?? resolutionErr?.message)
      : `Routing telemetry online: ${routeCount ?? 0} 404 event(s) last hour, ${resolutionCount ?? 0} resolved path(s) tracked`,
    target: "route_404_events,route_404_resolutions",
  });

  return out;
}



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
  const routeFindings: Finding[] = [];

  // Route probes — every page declared in App.tsx (parameterized routes use sample IDs).
  const SAMPLE_ID = "00000000-0000-0000-0000-000000000000";
  const routes = [
    // public / onboarding
    "/", "/welcome", "/welcome/quiz", "/welcome/plan",
    "/notifications", "/profile/edit", "/unsubscribe",
    "/support", "/support/contact",
    "/legal/terms", "/legal/privacy", "/legal/cancellations",
    // auth
    "/auth/signin", "/auth/student-signup", "/auth/instructor-signup",
    "/auth/credential-verification", "/auth/forgot-password", "/auth/reset-password",
    "/auth/change-password",
    "/auth/instructor/plan", "/auth/instructor/credential", "/auth/instructor/policy",
    `/auth/invite/${SAMPLE_ID}`, `/i/${SAMPLE_ID}`,
    // student
    "/student", "/student/discover", "/student/bookings", "/student/progress",
    "/student/operator", "/student/reviews", "/student/profile", "/student/settings",
    "/student/payment-methods", "/student/messages",
    `/student/course/${SAMPLE_ID}`, `/student/checkout/${SAMPLE_ID}`,
    `/student/checkout/${SAMPLE_ID}/return`, `/student/booking-success/${SAMPLE_ID}`,
    `/student/booking/${SAMPLE_ID}`, `/student/review/${SAMPLE_ID}`,
    `/student/messages/${SAMPLE_ID}`,
    // instructor
    "/instructor", "/instructor/dashboard", "/instructor/courses",
    "/instructor/courses/new", "/instructor/profile", "/instructor/settings",
    "/instructor/messages", "/instructor/credentials", "/instructor/roster",
    "/instructor/reviews", "/instructor/payment-methods", "/instructor/payouts",
    "/instructor/payout-methods", "/instructor/subscription",
    `/instructor/courses/${SAMPLE_ID}`, `/instructor/courses/${SAMPLE_ID}/edit`,
    `/instructor/messages/${SAMPLE_ID}`,
    // admin
    "/admin/login", "/admin", "/admin/owner-console", "/admin/cockpit", "/admin/brief",
    "/admin/influencers", "/admin/users", "/admin/instructors", "/admin/courses",
    "/admin/waivers", "/admin/course-editor", "/admin/featured", "/admin/conversations",
    `/admin/conversations/${SAMPLE_ID}`,
    "/admin/moderation", "/admin/deposit-review", "/admin/financials",
    "/admin/fee-overrides", "/admin/refunds", "/admin/bug-triage", "/admin/reliability",
    "/admin/reports", "/admin/feedback", "/admin/support", "/admin/activity",
    "/admin/flags", "/admin/test-accounts", "/admin/warrior-quotes", "/admin/security",
    "/admin/helcim-webhooks", "/admin/refund-test", "/admin/uptime",
    "/admin/background-videos", "/admin/subscription-plans", "/admin/settings",
  ];
  // Run probes in parallel batches of 8 to stay within edge runtime time budget.
  const BATCH = 8;
  for (let i = 0; i < routes.length; i += BATCH) {
    const slice = routes.slice(i, i + BATCH);
    const results = await Promise.all(slice.map((r) => probeUrl(`${APP_URL}${r}`)));
    routeFindings.push(...results);
    findings.push(...results);
  }
  // `probeUrl` also samples the HTML body for the NotFound marker so SPA
  // fallback pages that return HTTP 200 but render the client 404 are caught.

  // Edge function reachability
  const fns = [
    "uptime-runner", "admin-ai", "create-helcim-checkout",
    "verify-checkin-qr", "subscription-plan-ai", "ai-propose",
  ];
  for (const f of fns) findings.push(await probeEdgeFn(f));

  // Onboarding redirect safety + routing telemetry
  findings.push(...(await onboardingReliabilityChecks(admin, routeFindings)));

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
