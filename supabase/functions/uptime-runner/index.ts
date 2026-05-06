// Built-in uptime monitor runner.
//
// Two modes:
//   POST /uptime-runner               -> sweep: check every active monitor
//                                        whose interval has elapsed +
//                                        refresh domain_status for tracked domains.
//   POST /uptime-runner { monitor_id } -> force-check one monitor immediately
//                                        (admin "Check now" button).
//
// Auth model:
//   - sweep mode requires `x-cron-secret` header matching CRON_SECRET
//   - single-monitor mode requires the caller to be an authenticated admin
//
// What a check records:
//   - HTTP status, latency in ms, error string
//   - SSL certificate days-remaining (best-effort via fetch +
//     Deno.connectTls / TLS handshake — we use a HEAD request and parse the
//     `expires` from the cert when available; falls back to null on edge runtime).
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

type Monitor = {
  id: string;
  url: string;
  expected_status: number;
  interval_minutes: number;
  consecutive_failures: number;
  alert_threshold: number;
  last_alert_sent_at: string | null;
  alert_emails: string[] | null;
  name: string;
};

type CheckResult = {
  status: "up" | "down" | "degraded";
  http_status: number | null;
  response_ms: number | null;
  ssl_days_remaining: number | null;
  ssl_expires_at: string | null;
  error: string | null;
};

const TIMEOUT_MS = 12_000;

async function getSslExpiry(host: string): Promise<{ at: string | null; days: number | null }> {
  try {
    // @ts-ignore Deno.connectTls is available in Edge runtime
    const conn = await Deno.connectTls({ hostname: host, port: 443 });
    // @ts-ignore — handshake is implicit; peer certs available in some runtimes
    const certs = (conn as any).peerCertificates ?? null;
    try { conn.close(); } catch { /* ignore */ }
    if (!certs || !certs.length) return { at: null, days: null };
    const cert = certs[0];
    const notAfter = cert?.notAfter ?? cert?.validTo ?? null;
    if (!notAfter) return { at: null, days: null };
    const exp = new Date(notAfter);
    if (Number.isNaN(exp.getTime())) return { at: null, days: null };
    const days = Math.floor((exp.getTime() - Date.now()) / 86_400_000);
    return { at: exp.toISOString(), days };
  } catch {
    return { at: null, days: null };
  }
}

async function probe(monitor: Pick<Monitor, "url" | "expected_status">): Promise<CheckResult> {
  const started = performance.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(monitor.url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "TacLink-Uptime/1.0" },
    });
    // Drain to free the connection
    try { await res.arrayBuffer(); } catch { /* ignore */ }
    const ms = Math.round(performance.now() - started);
    const okExpected = res.status === monitor.expected_status;
    const ok2xx = res.status >= 200 && res.status < 400;
    const status: CheckResult["status"] = okExpected ? "up" : (ok2xx ? "degraded" : "down");

    // SSL expiry (best-effort) for https URLs only
    let sslDays: number | null = null;
    let sslAt: string | null = null;
    try {
      const u = new URL(monitor.url);
      if (u.protocol === "https:") {
        const r = await getSslExpiry(u.hostname);
        sslAt = r.at; sslDays = r.days;
      }
    } catch { /* ignore */ }

    return {
      status,
      http_status: res.status,
      response_ms: ms,
      ssl_days_remaining: sslDays,
      ssl_expires_at: sslAt,
      error: status === "down" ? `unexpected status ${res.status}` :
             (status === "degraded" ? `expected ${monitor.expected_status}, got ${res.status}` : null),
    };
  } catch (e: any) {
    const ms = Math.round(performance.now() - started);
    return {
      status: "down",
      http_status: null,
      response_ms: ms,
      ssl_days_remaining: null,
      ssl_expires_at: null,
      error: e?.name === "AbortError" ? "timeout" : (e?.message ?? "network error"),
    };
  } finally {
    clearTimeout(t);
  }
}

async function runMonitor(admin: any, m: Monitor) {
  const result = await probe(m);

  // Insert check
  await admin.from("uptime_checks").insert({
    monitor_id: m.id,
    status: result.status,
    http_status: result.http_status,
    response_ms: result.response_ms,
    ssl_days_remaining: result.ssl_days_remaining,
    error: result.error,
  });

  const wasDown = m.consecutive_failures > 0;
  const isDown = result.status === "down";
  const newFails = isDown ? m.consecutive_failures + 1 : 0;

  // Should we alert? Threshold reached AND no alert in the last hour.
  let shouldAlert = false;
  if (isDown && newFails >= m.alert_threshold) {
    const last = m.last_alert_sent_at ? new Date(m.last_alert_sent_at).getTime() : 0;
    if (Date.now() - last > 60 * 60 * 1000) shouldAlert = true;
  }

  const update: any = {
    last_status: result.status,
    last_checked_at: new Date().toISOString(),
    last_error: result.error,
    consecutive_failures: newFails,
  };
  if (shouldAlert) update.last_alert_sent_at = new Date().toISOString();

  await admin.from("uptime_monitors").update(update).eq("id", m.id);

  // Notification rows for admins (one per alert) — visible in NotificationsBell
  if (shouldAlert || (wasDown && !isDown)) {
    const recipients = (m.alert_emails ?? []);
    const { data: admins } = await admin.from("user_roles").select("user_id").eq("role", "admin");
    for (const a of admins ?? []) {
      await admin.from("notifications").insert({
        recipient_id: (a as any).user_id,
        type: shouldAlert ? "uptime_down" : "uptime_recovered",
        title: shouldAlert ? `🚨 ${m.name} is DOWN` : `✅ ${m.name} recovered`,
        body: shouldAlert
          ? `${m.url} returned ${result.http_status ?? "no response"} — ${result.error ?? "unknown error"}`
          : `${m.url} is responding again.`,
        link: "/admin/uptime",
      });
    }
    // Best-effort email alert (skipped silently if template missing)
    if (shouldAlert && recipients.length > 0) {
      for (const email of recipients) {
        try {
          await admin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "system-alert",
              recipientEmail: email,
              templateData: {
                title: `${m.name} is DOWN`,
                body: `${m.url} returned ${result.http_status ?? "no response"} — ${result.error ?? "unknown error"}`,
              },
            },
          });
        } catch { /* ignore — UI alert is the primary signal */ }
      }
    }
  }
  return result;
}

async function refreshDomainStatus(admin: any) {
  const { data: rows } = await admin.from("domain_status").select("id, domain");
  for (const row of rows ?? []) {
    const url = `https://${row.domain}`;
    const result = await probe({ url, expected_status: 200 });
    await admin.from("domain_status").update({
      last_checked_at: new Date().toISOString(),
      https_ok: result.status !== "down",
      http_status: result.http_status,
      ssl_valid: result.ssl_days_remaining === null ? null : result.ssl_days_remaining > 0,
      ssl_expires_at: result.ssl_expires_at,
      ssl_days_remaining: result.ssl_days_remaining,
      error: result.error,
    }).eq("id", row.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { monitor_id?: string; include_domains?: boolean } = {};
  try { body = await req.json(); } catch { /* sweep */ }

  // Single-monitor admin invocation
  if (body.monitor_id) {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    const { data: r } = await admin.from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!r) return json({ error: "forbidden" }, 403);

    const { data: m } = await admin.from("uptime_monitors").select("*").eq("id", body.monitor_id).maybeSingle();
    if (!m) return json({ error: "monitor not found" }, 404);
    const result = await runMonitor(admin, m as Monitor);
    return json({ ok: true, result });
  }

  // Sweep mode — require cron secret
  const expected = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!expected || provided !== expected) {
    return json({ error: "forbidden — sweep requires x-cron-secret" }, 403);
  }

  const now = Date.now();
  const { data: monitors } = await admin
    .from("uptime_monitors")
    .select("*")
    .eq("active", true);

  const due = (monitors ?? []).filter((m: any) => {
    if (!m.last_checked_at) return true;
    const next = new Date(m.last_checked_at).getTime() + m.interval_minutes * 60_000;
    return now >= next;
  });

  const results: any[] = [];
  for (const m of due) {
    try {
      const r = await runMonitor(admin, m as Monitor);
      results.push({ monitor: m.id, ok: true, status: r.status });
    } catch (e: any) {
      results.push({ monitor: m.id, ok: false, error: e?.message });
    }
  }

  await refreshDomainStatus(admin);

  return json({ ok: true, checked: results.length, total_active: monitors?.length ?? 0, results });
});
