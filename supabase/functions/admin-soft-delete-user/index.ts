// Admin-only soft-delete: bans the auth user (blocks login) and marks
// their profile account_status = 'disabled'. Can be reversed via
// admin-restore-user. Does NOT remove any data.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const body = (await req.json().catch(() => ({}))) as {
      userId?: string;
      reason?: string;
      mode?: "disable" | "restore";
    };
    const { userId, reason, mode = "disable" } = body;
    if (!userId || typeof userId !== "string") {
      return json({ error: "userId is required" }, 400);
    }
    if (userId === userData.user.id) {
      return json({ error: "You cannot disable your own account." }, 400);
    }

    if (mode === "disable") {
      // Block the last remaining admin from being disabled
      const { data: targetRoles } = await admin
        .from("user_roles").select("role").eq("user_id", userId);
      const isAdmin = (targetRoles ?? []).some((r) => r.role === "admin");
      if (isAdmin) {
        const { count } = await admin
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "admin");
        if ((count ?? 0) <= 1) {
          return json({ error: "Cannot disable the last remaining admin." }, 400);
        }
      }

      // Ban the auth user indefinitely (blocks login, invalidates sessions)
      const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: "876000h", // ~100 years
      });
      if (banErr) return json({ error: `Auth ban failed: ${banErr.message}` }, 500);

      const { error: profErr } = await admin
        .from("profiles")
        .update({
          account_status: "disabled",
          disabled_at: new Date().toISOString(),
          disabled_by: userData.user.id,
          disabled_reason: reason ?? null,
        })
        .eq("id", userId);
      if (profErr) return json({ error: profErr.message }, 500);

      await admin.from("admin_audit_log").insert({
        admin_id: userData.user.id,
        admin_email: userData.user.email ?? null,
        action: "soft_delete_account",
        target_type: "user",
        target_id: userId,
        before_value: { account_status: "active_or_other" },
        after_value: { account_status: "disabled", banned: true },
        reason: reason ?? null,
        source: "admin_ui",
      });

      return json({ ok: true, mode: "disable" });
    }

    // restore
    const { error: unbanErr } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: "none",
    });
    if (unbanErr) return json({ error: `Unban failed: ${unbanErr.message}` }, 500);

    const { error: profErr } = await admin
      .from("profiles")
      .update({
        account_status: "active",
        disabled_at: null,
        disabled_by: null,
        disabled_reason: null,
      })
      .eq("id", userId);
    if (profErr) return json({ error: profErr.message }, 500);

    await admin.from("admin_audit_log").insert({
      admin_id: userData.user.id,
      admin_email: userData.user.email ?? null,
      action: "restore_account",
      target_type: "user",
      target_id: userId,
      before_value: { account_status: "disabled" },
      after_value: { account_status: "active" },
      reason: reason ?? null,
      source: "admin_ui",
    });

    return json({ ok: true, mode: "restore" });
  } catch (e) {
    console.error("admin-soft-delete-user error", e);
    return json({ error: (e as Error).message ?? "Internal error" }, 500);
  }
});
