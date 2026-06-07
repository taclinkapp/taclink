// Admin-only edge function to create / list / delete / rotate fake test accounts
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

// Per-admin, per-role daily creation cap (UTC day).
const DAILY_LIMIT_PER_ROLE = 10;

type Action =
  | { action: "list" }
  | { action: "create"; role: "instructor" | "student"; label?: string }
  | { action: "delete"; id: string }
  | { action: "rotate" }
  | { action: "ensure_backdoor" }
  | { action: "seed_mock_data" };

// Fixed-credential backdoor accounts: persistent test users that bypass
// onboarding (subscription, credential upload, policy ack) so an admin can
// log straight in as either role for QA / screenshots / demos.
const BACKDOOR_PASSWORD = "BackDoor!Taclink2026";
const BACKDOOR = {
  instructor: {
    email: "backdoor.instructor@taclink.test",
    display_name: "Backdoor Instructor",
    label: "Backdoor — full instructor access",
  },
  student: {
    email: "backdoor.student@taclink.test",
    display_name: "Backdoor Student",
    label: "Backdoor — full student access",
  },
} as const;

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
  const base = crypto.randomUUID().replace(/-/g, "");
  return `Qa!${base.slice(0, 10)}A1`;
}

async function countTodayForAdmin(
  admin: ReturnType<typeof createClient>,
  adminId: string,
  role: "instructor" | "student",
) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count, error } = await admin
    .from("test_accounts")
    .select("id", { count: "exact", head: true })
    .eq("created_by", adminId)
    .eq("role", role)
    .gte("created_at", startOfDay.toISOString());
  if (error) throw error;
  return count ?? 0;
}

async function provisionAccount(
  admin: ReturnType<typeof createClient>,
  role: "instructor" | "student",
  adminId: string,
  label: string | null,
) {
  const email = randomEmail(role);
  const password = randomPassword();
  const display_name = `QA ${role === "instructor" ? "Instructor" : "Student"} ${new Date().toLocaleString()}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, display_name, is_test_account: true },
  });
  if (createErr || !created.user) {
    throw new Error(createErr?.message ?? "Failed to create user");
  }

  const { data: row, error: insertErr } = await admin
    .from("test_accounts")
    .insert({
      user_id: created.user.id,
      email,
      role,
      label,
      created_by: adminId,
    })
    .select()
    .single();
  if (insertErr) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    throw insertErr;
  }
  // IMPORTANT: password is returned ONLY at creation time and never persisted.
  return { ...row, password };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);
    const token = authHeader.replace(/^Bearer\s+/i, "");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: claimsData, error: claimsErr } = await admin.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      console.error("auth.getClaims failed", claimsErr);
      return json({ error: "Not authenticated" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
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

      const [instructorToday, studentToday] = await Promise.all([
        countTodayForAdmin(admin, userId, "instructor"),
        countTodayForAdmin(admin, userId, "student"),
      ]);

      return json({
        accounts: data ?? [],
        limits: {
          per_role_per_day: DAILY_LIMIT_PER_ROLE,
          today: { instructor: instructorToday, student: studentToday },
        },
      });
    }

    if (body.action === "create") {
      const role = body.role;
      if (role !== "instructor" && role !== "student") {
        return json({ error: "role must be instructor or student" }, 400);
      }

      const usedToday = await countTodayForAdmin(admin, userId, role);
      if (usedToday >= DAILY_LIMIT_PER_ROLE) {
        return json(
          {
            error: `Daily limit reached: you can create at most ${DAILY_LIMIT_PER_ROLE} fake ${role} accounts per day. Resets at 00:00 UTC.`,
          },
          429,
        );
      }

      const row = await provisionAccount(
        admin,
        role,
        userId,
        body.label?.trim() || null,
      );
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

    if (body.action === "rotate") {
      // One-click reset: delete every existing fake account, then re-provision
      // the same number per role with fresh emails/passwords. Skips daily-limit
      // checks (rotation preserves count, doesn't grow it) but caps total work.
      const { data: existing, error: listErr } = await admin
        .from("test_accounts")
        .select("*");
      if (listErr) throw listErr;

      const snapshot = existing ?? [];
      if (snapshot.length > 100) {
        return json({ error: "Too many accounts to rotate at once (max 100)." }, 400);
      }

      // Delete all existing
      let deleted = 0;
      for (const row of snapshot) {
        const { error: delAuthErr } = await admin.auth.admin.deleteUser(row.user_id);
        if (delAuthErr && !/not.*found/i.test(delAuthErr.message)) {
          console.warn("rotate: failed to delete auth user", row.user_id, delAuthErr.message);
        }
        await admin.from("test_accounts").delete().eq("id", row.id);
        deleted++;
      }

      // Re-provision the same role mix and labels
      const created: unknown[] = [];
      for (const row of snapshot) {
        try {
          const fresh = await provisionAccount(
            admin,
            row.role as "instructor" | "student",
            userId,
            row.label ?? null,
          );
          created.push(fresh);
        } catch (e) {
          console.error("rotate: provision failed", (e as Error).message);
        }
      }

      return json({ ok: true, deleted, created: created.length });
    }

    if (body.action === "ensure_backdoor") {
      // Idempotent: for each role, find-or-create the fixed-email auth user,
      // reset its password, mark fully onboarded, ensure role + test_accounts row.
      const results: Array<{ role: string; email: string; password: string }> = [];
      for (const role of ["instructor", "student"] as const) {
        const cfg = BACKDOOR[role];

        // Find existing auth user by email
        let userIdForRole: string | null = null;
        const { data: list, error: listErr } = await admin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        if (listErr) throw listErr;
        const existing = list.users.find(
          (u) => (u.email ?? "").toLowerCase() === cfg.email.toLowerCase(),
        );

        if (existing) {
          userIdForRole = existing.id;
          await admin.auth.admin.updateUserById(existing.id, {
            password: BACKDOOR_PASSWORD,
            email_confirm: true,
            user_metadata: {
              role,
              display_name: cfg.display_name,
              is_test_account: true,
              is_backdoor: true,
            },
          });
        } else {
          const { data: created, error: createErr } = await admin.auth.admin.createUser({
            email: cfg.email,
            password: BACKDOOR_PASSWORD,
            email_confirm: true,
            user_metadata: {
              role,
              display_name: cfg.display_name,
              is_test_account: true,
              is_backdoor: true,
            },
          });
          if (createErr || !created.user) {
            throw new Error(createErr?.message ?? `Failed to create backdoor ${role}`);
          }
          userIdForRole = created.user.id;
        }

        // Profile: mark fully onboarded
        await admin.from("profiles").upsert(
          {
            id: userIdForRole,
            display_name: cfg.display_name,
            onboarding_started_at: new Date().toISOString(),
            onboarding_completed_at: new Date().toISOString(),
            subscription_chosen_at: new Date().toISOString(),
            credential_uploaded_at:
              role === "instructor" ? new Date().toISOString() : null,
            policy_acknowledged_at: new Date().toISOString(),
            subscription_status: role === "instructor" ? "active" : "free",
          },
          { onConflict: "id" },
        );

        // Role row
        await admin
          .from("user_roles")
          .upsert(
            { user_id: userIdForRole, role },
            { onConflict: "user_id,role", ignoreDuplicates: true },
          );

        // Track in test_accounts (one row per backdoor account, deduped by user_id)
        const { data: existingRow } = await admin
          .from("test_accounts")
          .select("id")
          .eq("user_id", userIdForRole)
          .maybeSingle();
        if (!existingRow) {
          await admin.from("test_accounts").insert({
            user_id: userIdForRole,
            email: cfg.email,
            role,
            label: cfg.label,
            created_by: userId,
          });
        }

        results.push({ role, email: cfg.email, password: BACKDOOR_PASSWORD });
      }
      return json({ ok: true, backdoor: results });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("manage-test-accounts error", e);
    return json({ error: (e as Error).message ?? "Internal error" }, 500);
  }
});
