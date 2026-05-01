// Admin-only edge function to create / list / delete fake test accounts
// for repeatable onboarding QA. Uses the service-role key to provision
// confirmed auth.users and clean them up.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Action =
  | { action: "list" }
  | { action: "create"; role: "instructor" | "student"; label?: string }
  | { action: "delete"; id: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function randomEmail(role: string) {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return `qa+${role}-${stamp}@taclink.test`;
}

function randomPassword() {
  // Strong-enough password meeting common rules: upper, lower, digit, symbol.
  const base = crypto.randomUUID().replace(/-/g, "");
  return `Qa!${base.slice(0, 10)}A1`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

    // Verify caller is an admin using their JWT.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Admin role required" }, 403);

    const body = (await req.json().catch(() => ({}))) as Action;

    if (body.action === "list") {
      const { data, error } = await admin
        .from("test_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ accounts: data ?? [] });
    }

    if (body.action === "create") {
      const role = body.role;
      if (role !== "instructor" && role !== "student") {
        return json({ error: "role must be instructor or student" }, 400);
      }
      const email = randomEmail(role);
      const password = randomPassword();
      const display_name = `QA ${role === "instructor" ? "Instructor" : "Student"} ${new Date().toLocaleString()}`;

      // Create confirmed auth user; handle_new_user trigger creates profile + role row.
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role,
          display_name,
          is_test_account: true,
        },
      });
      if (createErr || !created.user) {
        return json({ error: createErr?.message ?? "Failed to create user" }, 500);
      }

      const { data: row, error: insertErr } = await admin
        .from("test_accounts")
        .insert({
          user_id: created.user.id,
          email,
          password,
          role,
          label: body.label ?? null,
          created_by: userData.user.id,
        })
        .select()
        .single();
      if (insertErr) {
        // Best-effort cleanup if metadata insert fails
        await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
        throw insertErr;
      }

      return json({ account: row });
    }

    if (body.action === "delete") {
      const { data: row, error: fetchErr } = await admin
        .from("test_accounts")
        .select("*")
        .eq("id", body.id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!row) return json({ error: "Not found" }, 404);

      // Delete auth user (cascades to profile/roles via FKs / trigger cleanup).
      const { error: delAuthErr } = await admin.auth.admin.deleteUser(row.user_id);
      if (delAuthErr && !/not.*found/i.test(delAuthErr.message)) {
        return json({ error: delAuthErr.message }, 500);
      }

      const { error: delRowErr } = await admin
        .from("test_accounts")
        .delete()
        .eq("id", body.id);
      if (delRowErr) throw delRowErr;

      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("manage-test-accounts error", e);
    return json({ error: (e as Error).message ?? "Internal error" }, 500);
  }
});
