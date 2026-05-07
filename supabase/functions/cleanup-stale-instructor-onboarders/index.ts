import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: stale, error } = await supabase.rpc(
    "list_stale_instructor_onboarders",
    { _older_than_hours: 24 },
  );
  if (error) {
    console.error("list_stale_instructor_onboarders failed", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const deleted: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const row of stale ?? []) {
    const userId = row.user_id as string;
    try {
      const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
      if (delErr) throw delErr;
      deleted.push(userId);
    } catch (e: any) {
      failed.push({ id: userId, error: e?.message ?? String(e) });
    }
  }

  console.log(`cleanup-stale-instructor-onboarders: deleted=${deleted.length} failed=${failed.length}`);

  return new Response(
    JSON.stringify({ ok: true, deleted: deleted.length, failed }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
