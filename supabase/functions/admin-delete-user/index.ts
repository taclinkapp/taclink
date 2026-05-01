// Admin-only edge function to permanently delete a user account.
// Removes the auth.users row (cascades to user_roles and most public tables
// via FK / triggers) and writes a record to admin_audit_log.
//
// Safety:
//   - Caller must be an authenticated admin (verified via user_roles).
//   - An admin cannot delete their OWN account.
//   - The LAST remaining admin cannot be deleted.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    };
    const { userId, reason } = body;
    if (!userId || typeof userId !== "string") {
      return json({ error: "userId is required" }, 400);
    }

    if (userId === userData.user.id) {
      return json({ error: "You cannot delete your own account." }, 400);
    }

    // Snapshot target for audit
    const [{ data: targetProfile }, { data: targetRoles }] = await Promise.all([
      admin.from("profiles").select("id, display_name, account_status").eq("id", userId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const targetIsAdmin = (targetRoles ?? []).some((r) => r.role === "admin");
    if (targetIsAdmin) {
      const { count } = await admin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) {
        return json({ error: "Cannot delete the last remaining admin." }, 400);
      }
    }

    // Best-effort cleanup of public tables that don't cascade.
    // (auth.users delete normally cascades user_roles, profiles, etc., but
    // we explicitly clear test_accounts here in case this user was provisioned via QA.)
    await admin.from("test_accounts").delete().eq("user_id", userId).then(() => {}, () => {});

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      return json({ error: `Failed to delete auth user: ${delErr.message}` }, 500);
    }

    await admin.from("admin_audit_log").insert({
      admin_id: userData.user.id,
      admin_email: userData.user.email ?? null,
      action: "delete_account",
      target_type: "user",
      target_id: userId,
      before_value: {
        profile: targetProfile ?? null,
        roles: (targetRoles ?? []).map((r) => r.role),
      },
      after_value: null,
      reason: reason ?? null,
      source: "admin_ui",
    });

    return json({ ok: true });
  } catch (e) {
    console.error("admin-delete-user error", e);
    return json({ error: (e as Error).message ?? "Internal error" }, 500);
  }
});
