// Admin-only one-click maintenance: scan storage for uploaded profile photos
// that aren't linked to a profiles.photo_url, and link the most recent one
// per user. Mirror of the manual SQL migration we ran once — exposed in the
// admin UI so we can re-run it any time orphans appear.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const BUCKET = "profile-photos";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: callerRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!callerRole) return json({ error: "Admin role required" }, 403);

    const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
    const dryRun = !!body.dryRun;

    // List every object in profile-photos. The bucket folder layout is
    // `<user_id>/avatar-<ts>.<ext>`, so we group by the first path segment
    // and pick the most recent upload per user.
    const objects: { name: string; created_at: string }[] = [];
    let offset = 0;
    const limit = 1000;
    // Storage list() doesn't recurse — we list folders (user ids) first,
    // then files inside each. Simpler: query storage.objects via service role.
    const { data: rows, error: listErr } = await admin
      .schema("storage")
      .from("objects")
      .select("name, created_at")
      .eq("bucket_id", BUCKET)
      .order("created_at", { ascending: false })
      .limit(10000);
    if (listErr) return json({ error: `List failed: ${listErr.message}` }, 500);
    objects.push(...(rows ?? []));

    // Most recent file per user_id folder.
    const latestByUser = new Map<string, string>();
    for (const o of objects) {
      const userId = o.name.split("/")[0];
      if (!userId || latestByUser.has(userId)) continue;
      latestByUser.set(userId, o.name);
    }

    if (latestByUser.size === 0) {
      return json({ ok: true, scanned: 0, linked: 0, skipped: 0, dryRun });
    }

    const userIds = Array.from(latestByUser.keys());
    const { data: profiles, error: profErr } = await admin
      .from("profiles")
      .select("id, photo_url")
      .in("id", userIds);
    if (profErr) return json({ error: profErr.message }, 500);

    const fixes: { user_id: string; photo_url: string }[] = [];
    const skipped: string[] = [];
    for (const p of profiles ?? []) {
      const path = latestByUser.get(p.id);
      if (!path) continue;
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
      if (!p.photo_url || p.photo_url.trim() === "") {
        fixes.push({ user_id: p.id, photo_url: publicUrl });
      } else {
        skipped.push(p.id);
      }
    }

    let linked = 0;
    if (!dryRun && fixes.length > 0) {
      for (const f of fixes) {
        const { error: upErr } = await admin
          .from("profiles")
          .update({ photo_url: f.photo_url })
          .eq("id", f.user_id);
        if (!upErr) linked++;
      }
      await admin.from("admin_audit_log").insert({
        admin_id: userData.user.id,
        admin_email: userData.user.email ?? null,
        action: "backfill_profile_photos",
        target_type: "system",
        target_id: "profile-photos",
        before_value: { orphans_found: fixes.length },
        after_value: { linked },
        reason: "Admin one-click photo backfill",
        source: "admin_ui",
      });
    }

    return json({
      ok: true,
      scanned: latestByUser.size,
      orphansFound: fixes.length,
      linked: dryRun ? 0 : linked,
      alreadyLinked: skipped.length,
      dryRun,
      sample: fixes.slice(0, 5),
    });
  } catch (e) {
    console.error("admin-backfill-profile-photos error", e);
    return json({ error: (e as Error).message ?? "Internal error" }, 500);
  }
});
