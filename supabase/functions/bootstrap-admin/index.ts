// One-shot helper: create (or update) the taclink admin account.
// Safe to re-run; it will only act on the hardcoded email/password pair.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "taclink@taclinkapp.com";
const ADMIN_PASSWORD = "Andygp320796503";
const ADMIN_DISPLAY = "TacLink Admin";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Try to find existing user
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw listErr;
    let user = list.users.find((u) => (u.email ?? "").toLowerCase() === ADMIN_EMAIL.toLowerCase()) ?? null;

    if (!user) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: ADMIN_DISPLAY, role: "instructor" },
      });
      if (createErr) throw createErr;
      user = created.user;
    } else {
      // Ensure password matches and email is confirmed
      const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, {
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });
      if (updErr) throw updErr;
    }

    if (!user) throw new Error("Failed to resolve admin user");

    // Upsert profile
    await supabase.from("profiles").upsert({ id: user.id, display_name: ADMIN_DISPLAY }, { onConflict: "id" });

    // Grant admin role (idempotent)
    const { error: roleErr } = await supabase
      .from("user_roles")
      .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });
    if (roleErr) throw roleErr;

    return new Response(
      JSON.stringify({ ok: true, user_id: user.id, email: user.email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
