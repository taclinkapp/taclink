import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PRO_PLAN_ID = "d093c86a-a2ff-45ff-9ad7-c906d4ac77c2";

const PASSWORD = "@Algp320796503";

async function ensureUser(admin: any, email: string, displayName: string, role: "instructor" | "student") {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = list?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
  const meta: Record<string, unknown> = { display_name: displayName, role };
  if (role === "student") meta.date_of_birth = "1990-01-01";
  if (user) {
    await admin.auth.admin.updateUserById(user.id, {
      password: PASSWORD,
      email_confirm: true,
      ban_duration: "none",
      user_metadata: { ...(user.user_metadata ?? {}), ...meta },
    });
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error) throw error;
    user = data.user;
  }
  return user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth check: caller must be admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user: caller } } = await userClient.auth.getUser();
  if (!caller) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: caller.id, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin required" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1) Instructor: andygp503@gmail.com — Pro, credentials approved, policy ack, profile complete
    const instructor = await ensureUser(admin, "andygp503@gmail.com", "Andy GP (Instructor)", "instructor");
    const now = new Date().toISOString();
    const periodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    await admin.from("profiles").upsert({
      id: instructor.id,
      display_name: "Andy GP (Instructor)",
      account_status: "active",
      subscription_status: "active",
      subscription_updated_at: now,
      payment_method_added: true,
      service_state: "TX",
      service_city: "Austin",
      service_categories: ["firearms"],
      onboarding_started_at: now,
      onboarding_completed_at: now,
      subscription_chosen_at: now,
      credential_uploaded_at: now,
      policy_acknowledged_at: now,
    });

    await admin.from("user_roles").upsert(
      { user_id: instructor.id, role: "instructor" },
      { onConflict: "user_id,role" }
    );

    // Subscription row — Pro
    await admin.from("subscriptions").upsert({
      user_id: instructor.id,
      product_id: PRO_PLAN_ID,
      status: "active",
      current_period_start: now,
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      environment: "live",
      payment_provider: "manual_grant",
    }, { onConflict: "user_id" });

    // Approved credential so onboarding gate passes
    await admin.from("instructor_credentials").insert({
      instructor_id: instructor.id,
      credential_type: "certification",
      display_name: "Manual test grant",
      file_path: "manual-grant/placeholder.pdf",
      file_mime: "application/pdf",
      status: "approved",
      admin_notes: "Granted via provision-test-accounts for test account",
      reviewed_by: caller.id,
      reviewed_at: now,
      ai_decided_at: now,
    });

    // Policy ack
    await admin.from("policy_acknowledgments").insert({
      user_id: instructor.id,
      policy_version: "v1",
      user_agent: "provision-test-accounts",
    });

    // 2) Student: andylgonzalezperez@gmail.com
    const student = await ensureUser(admin, "andylgonzalezperez@gmail.com", "Andy LGP (Student)", "student");

    await admin.from("profiles").upsert({
      id: student.id,
      display_name: "Andy LGP (Student)",
      account_status: "active",
      payment_method_added: true,
      state: "TX",
    });

    await admin.from("user_roles").upsert(
      { user_id: student.id, role: "student" },
      { onConflict: "user_id,role" }
    );

    await admin.from("student_onboarding").upsert({
      user_id: student.id,
      experience_level: "beginner",
      training_goal: "general",
      selected_pillars: ["firearms"],
      travel_radius_miles: 50,
      checklist_dismissed: true,
      quiz_completed_at: now,
    }, { onConflict: "user_id" });

    return new Response(JSON.stringify({
      ok: true,
      instructor_id: instructor.id,
      student_id: student.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("provision failed", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
