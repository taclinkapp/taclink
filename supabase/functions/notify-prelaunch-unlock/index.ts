// Notify all instructors that pre-launch has ended and Pro is unlocked.
// One email per recipient, idempotent across the whole launch event via
// platform_settings.prelaunch_unlock_notified_at.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Authn: require an admin caller.
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Parse optional `force` flag (admin can re-trigger if needed).
  let force = false;
  try {
    const body = await req.json();
    force = body?.force === true;
  } catch {
    // no body — fine
  }

  // Refuse if pre-launch is still ON.
  const { data: settings, error: settingsErr } = await admin
    .from("platform_settings")
    .select("key,value")
    .in("key", ["prelaunch_mode", "prelaunch_unlock_notified_at"]);

  if (settingsErr) {
    return new Response(JSON.stringify({ error: settingsErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const map = new Map((settings ?? []).map((r: any) => [r.key, r.value]));
  const prelaunchOn = map.get("prelaunch_mode") === true || map.get("prelaunch_mode") === "true";
  if (prelaunchOn) {
    return new Response(
      JSON.stringify({ error: "Pre-launch is still enabled — toggle it off first." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const lastNotified = map.get("prelaunch_unlock_notified_at");
  if (lastNotified && lastNotified !== null && !force) {
    return new Response(
      JSON.stringify({
        skipped: true,
        reason: "already_notified",
        notified_at: lastNotified,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Pull every instructor's user_id, then resolve email + name.
  const { data: roleRows, error: rolesErr } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "instructor");

  if (rolesErr) {
    return new Response(JSON.stringify({ error: rolesErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const instructorIds = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id)));
  console.log(`[notify-prelaunch-unlock] resolving ${instructorIds.length} instructor(s)`);

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", instructorIds.length ? instructorIds : ["00000000-0000-0000-0000-000000000000"]);

  const nameById = new Map<string, string>();
  for (const p of profiles ?? []) nameById.set(p.id, p.display_name ?? "");

  const subscriptionUrl = "https://taclinkapp.com/instructor/subscription";
  const monthlyPriceUsd = "$29";

  let queued = 0;
  let failed = 0;

  // Send one-by-one (each is its own transactional event triggered by the
  // launch toggling off). The downstream queue handles retries/rate limits.
  for (const userId of instructorIds) {
    // Resolve the email via auth admin API.
    const { data: u, error: e } = await admin.auth.admin.getUserById(userId);
    if (e || !u?.user?.email) {
      console.warn(`[notify-prelaunch-unlock] no email for ${userId}`, e?.message);
      failed++;
      continue;
    }
    const recipientEmail = u.user.email;
    const instructorName = nameById.get(userId) || "";

    const idempotencyKey = `prelaunch-unlock-${userId}-${lastNotified ?? "first"}`;

    const { error: invokeErr } = await admin.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "prelaunch-unlocked",
          recipientEmail,
          idempotencyKey,
          templateData: { instructorName, subscriptionUrl, monthlyPriceUsd },
        },
      },
    );
    if (invokeErr) {
      console.error(`[notify-prelaunch-unlock] send failed for ${recipientEmail}`, invokeErr);
      failed++;
    } else {
      queued++;
    }
  }

  // Mark notified so we don't double-fire.
  await admin
    .from("platform_settings")
    .update({ value: new Date().toISOString() })
    .eq("key", "prelaunch_unlock_notified_at");

  return new Response(
    JSON.stringify({ ok: true, queued, failed, total: instructorIds.length }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
