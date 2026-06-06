// ai-daily-digest — runs daily, summarizes Owner Console activity
// and posts an in-app notification to every admin.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: actions } = await admin
    .from("ai_actions")
    .select("kind, status, created_at, executed_at")
    .gte("created_at", since);

  const counts = {
    proposed: 0,
    executed: 0,
    rejected: 0,
    auto_paused: 0,
    failed: 0,
  };
  const byKind: Record<string, number> = {};
  for (const a of actions ?? []) {
    if (a.status in counts) (counts as any)[a.status]++;
    byKind[a.kind] = (byKind[a.kind] ?? 0) + 1;
  }

  const { count: pendingCount } = await admin
    .from("ai_actions")
    .select("id", { count: "exact", head: true })
    .in("status", ["proposed", "auto_paused"]);

  const lines: string[] = [];
  lines.push(`📥 ${pendingCount ?? 0} item${pendingCount === 1 ? "" : "s"} need your attention`);
  if (counts.executed) lines.push(`✅ ${counts.executed} approved & sent`);
  if (counts.rejected) lines.push(`❌ ${counts.rejected} rejected`);
  if (counts.failed) lines.push(`⚠️ ${counts.failed} failed`);
  const kindParts = Object.entries(byKind).map(([k, n]) => `${k}: ${n}`).join(", ");
  if (kindParts) lines.push(`Activity: ${kindParts}`);

  const body = lines.join(" • ");

  // Post one notification per admin
  const { data: admins } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  let sent = 0;
  for (const a of admins ?? []) {
    await admin.from("notifications").insert({
      recipient_id: a.user_id,
      type: "owner_digest",
      title: "Daily Owner Console digest",
      body,
      link: "/admin/owner-console",
    });
    sent++;
  }

  return new Response(
    JSON.stringify({ ok: true, sent, body, counts, byKind, pendingCount }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
