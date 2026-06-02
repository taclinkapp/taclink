// Scheduled (and on-demand) idempotent launch activation.
// Calls `activate_launch_if_due()` — safe to invoke any number of times.
// AuthZ: cron-secret OR admin JWT only. Previously this endpoint had no auth
// at all and any anonymous caller could trigger a platform-wide state mutation.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) {
    return new Response(JSON.stringify({ ok: false, error: "missing_env" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  // Gate 1: cron secret
  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  const cronOk = !!cronSecret && !!provided && provided === cronSecret;

  // Gate 2: admin JWT
  let adminOk = false;
  if (!cronOk) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      try {
        const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: u } = await userClient.auth.getUser();
        const uid = u?.user?.id;
        if (uid) {
          const admin = createClient(url, service);
          const { data: roleRow } = await admin
            .from("user_roles")
            .select("role")
            .eq("user_id", uid)
            .eq("role", "admin")
            .maybeSingle();
          adminOk = !!roleRow;
        }
      } catch (_) { /* fall through */ }
    }
  }

  if (!cronOk && !adminOk) {
    return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 403,
    });
  }

  try {
    const res = await fetch(`${url}/rest/v1/rpc/activate_launch_if_due`, {
      method: "POST",
      headers: {
        apikey: service,
        Authorization: `Bearer ${service}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const body = await res.json();
    return new Response(JSON.stringify({ ok: res.ok, result: body }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: res.ok ? 200 : 500,
    });
  } catch (e) {
    console.error("launch-activate error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
