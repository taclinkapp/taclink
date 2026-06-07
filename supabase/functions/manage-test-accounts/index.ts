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

// Seed advertising-quality mock content onto the two backdoor accounts.
// Idempotent: clears prior content for these two users, then re-creates a
// known baseline (instructor profile/courses/credential + student profile/
// onboarding/bookings/review). Used by `ensure_backdoor` (auto) and the
// explicit `seed_mock_data` action.
const MOCK_STUDENT_LABEL = "backdoor mock student";
const MOCK_STUDENT_EMAIL_PREFIX = "qa+mockstudent-";

const MOCK_STUDENT_NAMES = [
  "Tyler Hawkins", "Sam Whitfield", "Diego Ramirez", "Jordan Pierce",
  "Brooke Sullivan", "Aaron Castillo", "Cole Bennett", "Wyatt Nguyen",
  "Logan McAllister", "Maddie Cross", "Ethan Park", "Ryan Doyle",
  "Brett Holloway", "Cody Vance", "Sierra Maddox", "Hunter Beaumont",
  "Carlos Ibarra", "Owen Brennan", "Reese Cavanaugh", "Trent Wilcox",
];

const MOCK_STUDENT_PHOTOS = [
  "photo-1500648767791-00dcc994a43e", // man portrait
  "photo-1531123897727-8f129e1688ce", // woman portrait
  "photo-1506794778202-cad84cf45f1d", // man portrait
  "photo-1438761681033-6461ffad8d80", // woman portrait
  "photo-1492562080023-ab3db95bfbce", // man portrait
  "photo-1544005313-94ddf0286df2", // woman portrait
  "photo-1463453091185-61582044d556", // man portrait
  "photo-1488161628813-04466f872be2", // woman portrait
  "photo-1507591064344-4c6ce005b128", // man portrait
  "photo-1517841905240-472988babdf9", // woman portrait
];

// Seed advertising-quality mock content onto the two backdoor accounts.
// Idempotent: clears prior content for these two users + previously seeded
// mock students, then re-creates a known baseline (instructor profile/courses/
// credential + student profile/onboarding/bookings/review + 20 mock students
// with bookings — 10 attended this month, 10 reserved/upcoming).
async function seedBackdoorMockData(
  admin: any,
  instructorId: string,
  studentId: string,
  adminUserId: string,
) {
  // ---- Clean up previously seeded mock students ----
  // Their bookings live on courses we're about to delete (cascade), so we
  // only need to drop the auth users (cascades profiles) + test_accounts rows.
  const { data: priorMocks } = await admin
    .from("test_accounts")
    .select("id, user_id")
    .eq("label", MOCK_STUDENT_LABEL);
  if (priorMocks?.length) {
    const ids = priorMocks.map((r: any) => r.id);
    await admin.from("test_accounts").delete().in("id", ids);
    for (const r of priorMocks) {
      try {
        await admin.auth.admin.deleteUser(r.user_id);
      } catch (e) {
        console.error("seed: deleteUser mock student failed", (e as Error).message);
      }
    }
  }

  // Clear prior mock content (cascades to bookings + reviews)
  await admin.from("courses").delete().eq("instructor_id", instructorId);
  await admin.from("instructor_credentials").delete().eq("instructor_id", instructorId);
  await admin.from("student_xp_awards").delete().eq("student_id", studentId);

  // ---- Instructor profile ----
  await admin.from("profiles").upsert(
    {
      id: instructorId,
      display_name: "Marcus Reed",
      photo_url:
        "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&h=400&fit=crop&crop=faces",
      phone: "+1 (512) 555-0142",
      state: "TX",
      service_state: "TX",
      service_city: "Austin",
      service_categories: ["Firearms", "CQB", "Medical", "Tactics"],
      bio:
        "Former U.S. Army Ranger (3rd Bn, 75th RR) with 12 years of service and 4 combat deployments. NRA-certified instructor and TCOLE firearms trainer. I teach hard-won fundamentals — weapon manipulation, low-light CQB, and battlefield medicine — to civilians, LEOs, and military shooters who want to train like operators.",
      payment_method_added: true,
      subscription_status: "active",
      subscription_updated_at: new Date().toISOString(),
      onboarding_started_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      onboarding_completed_at: new Date(Date.now() - 29 * 86400000).toISOString(),
      subscription_chosen_at: new Date(Date.now() - 29 * 86400000).toISOString(),
      credential_uploaded_at: new Date(Date.now() - 28 * 86400000).toISOString(),
      policy_acknowledged_at: new Date(Date.now() - 28 * 86400000).toISOString(),
      stripe_connect_status: "active",
      stripe_connect_account_id: "acct_test_backdoor_instructor",
    },
    { onConflict: "id" },
  );

  await admin.from("instructor_credentials").insert({
    instructor_id: instructorId,
    credential_type: "military_dd214",
    display_name: "DD-214 — U.S. Army Ranger",
    file_path: "mock/backdoor/dd214.pdf",
    file_mime: "application/pdf",
    status: "approved",
    ai_confidence: 0.98,
    ai_issuer: "United States Department of the Army",
    ai_holder_name: "Marcus Reed",
    ai_decided_at: new Date().toISOString(),
  });

  // ---- Courses ----
  const now = Date.now();
  const day = 86400000;
  const cover = (id: string) =>
    `https://images.unsplash.com/${id}?w=1200&h=800&fit=crop`;
  const courses = [
    {
      title: "Pistol Fundamentals — Draw, Press, Hit",
      description:
        "Two-day defensive pistol course covering grip, stance, draw stroke, recoil management, and combat reloads. Round count ~600. Bring eye/ear pro and a duty-style holster.",
      category: "Firearms",
      primary_pillar: "firearms",
      secondary_pillar: "tactics",
      price_cents: 39900,
      duration_minutes: 480,
      capacity: 20,
      location_name: "Reed Tactical Range",
      address: "12450 Range Rd",
      city: "Austin",
      state: "TX",
      lat: 30.2672,
      lng: -97.7431,
      skill_level: "beginner",
      starts_at: new Date(now + 7 * day).toISOString(),
      ends_at: new Date(now + 7 * day + 8 * 3600 * 1000).toISOString(),
      cover_image_url: cover("photo-1595590424283-b8f17842773f"),
    },
    {
      title: "Low-Light CQB — Force on Force",
      description:
        "Advanced room clearing, threshold work, and weapon-mounted light technique. Sim-rounds, role players, instrumented scenarios. Prereq: intermediate pistol/carbine.",
      category: "CQB",
      primary_pillar: "tactics",
      secondary_pillar: "firearms",
      price_cents: 59900,
      duration_minutes: 600,
      capacity: 16,
      location_name: "Hill Country Shoothouse",
      address: "8800 Ranch Rd 12",
      city: "Wimberley",
      state: "TX",
      lat: 30.0044,
      lng: -98.0972,
      skill_level: "advanced",
      starts_at: new Date(now + 21 * day).toISOString(),
      ends_at: new Date(now + 21 * day + 10 * 3600 * 1000).toISOString(),
      cover_image_url: cover("photo-1584553421349-3557471bed79"),
    },
    {
      title: "Tactical Combat Casualty Care (TCCC)",
      description:
        "Civilian TCCC curriculum: MARCH algorithm, tourniquet application, wound packing, needle decompression. Hands-on with live tissue analogs. Cert on completion.",
      category: "Medical",
      primary_pillar: "medical",
      secondary_pillar: null,
      price_cents: 29900,
      duration_minutes: 480,
      capacity: 20,
      location_name: "Reed Tactical HQ",
      address: "12450 Range Rd",
      city: "Austin",
      state: "TX",
      lat: 30.2672,
      lng: -97.7431,
      skill_level: "all_levels",
      starts_at: new Date(now - 14 * day).toISOString(),
      ends_at: new Date(now - 14 * day + 8 * 3600 * 1000).toISOString(),
      cover_image_url: cover("photo-1518152006812-edab29b069ac"),
    },
  ];

  const insertedCourses: any[] = [];
  for (const c of courses) {
    const { data, error } = await admin
      .from("courses")
      .insert({
        instructor_id: instructorId,
        status: "published",
        moderation_status: "approved",
        in_person_waiver: true,
        gallery_urls: [c.cover_image_url],
        ...c,
      })
      .select()
      .single();
    if (error) {
      console.error("seed: course insert failed", error.message);
      continue;
    }
    insertedCourses.push(data);
  }

  // ---- Student profile (backdoor student "Jake Calloway") ----
  await admin.from("profiles").upsert(
    {
      id: studentId,
      display_name: "Jake Calloway",
      photo_url:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces",
      phone: "+1 (737) 555-0199",
      state: "TX",
      service_state: "TX",
      service_city: "Austin",
      bio:
        "EDC carrier and weekend warrior. Training toward instructor-level pistol and a TCCC cert. Looking for real-world reps, not square-range theatre.",
      payment_method_added: true,
      subscription_status: "free",
      onboarding_started_at: new Date(Date.now() - 14 * day).toISOString(),
      onboarding_completed_at: new Date(Date.now() - 13 * day).toISOString(),
      subscription_chosen_at: new Date(Date.now() - 13 * day).toISOString(),
      policy_acknowledged_at: new Date(Date.now() - 13 * day).toISOString(),
    },
    { onConflict: "id" },
  );

  await admin.from("student_onboarding").upsert(
    {
      user_id: studentId,
      experience_level: "intermediate",
      training_goal: "Build defensive pistol + medical skills for EDC",
      selected_pillars: ["firearms", "medical", "tactics"],
      travel_radius_miles: 100,
      checklist: {
        profile_created: true,
        browsed_courses: true,
        first_booking: true,
        first_completion: true,
        followed_instructor: true,
        shared_profile: true,
      },
      checklist_dismissed: true,
      notif_prompt_shown: true,
      quiz_completed_at: new Date(Date.now() - 13 * day).toISOString(),
    },
    { onConflict: "user_id" },
  );

  const pastCourse = insertedCourses.find((c) => new Date(c.starts_at).getTime() < now);
  const upcomingCourses = insertedCourses.filter(
    (c) => new Date(c.starts_at).getTime() > now,
  );

  // Backdoor student: 1 attended (past) + 1 reserved (upcoming) + review
  if (pastCourse) {
    const { data: b, error: be } = await admin
      .from("bookings")
      .insert({
        student_id: studentId,
        course_id: pastCourse.id,
        status: "attended",
        attended_at: new Date(
          new Date(pastCourse.starts_at).getTime() + 6 * 3600 * 1000,
        ).toISOString(),
        booked_at: new Date(
          new Date(pastCourse.starts_at).getTime() - 7 * day,
        ).toISOString(),
        course_price_cents: pastCourse.price_cents,
        online_total_cents: pastCourse.price_cents,
        platform_fee_cents: 2500,
        escrow_status: "released",
        deposit_status: "released",
      })
      .select()
      .single();
    if (be) console.error("seed: past booking failed", be.message);

    if (b) {
      await admin.from("reviews").insert({
        course_id: pastCourse.id,
        instructor_id: instructorId,
        student_id: studentId,
        rating: 5,
        comment:
          "Best medical course I've taken outside the military. Marcus runs realistic scenarios under stress and gives feedback that actually sticks. Highly recommend.",
        instructor_reply:
          "Appreciate the kind words, Jake. Glad the TQ drills landed — see you in the pistol class.",
        instructor_reply_at: new Date().toISOString(),
      });
    }
  }

  if (upcomingCourses[0]) {
    const upcomingCourse = upcomingCourses[0];
    const { error: ube } = await admin.from("bookings").insert({
      student_id: studentId,
      course_id: upcomingCourse.id,
      status: "reserved",
      course_price_cents: upcomingCourse.price_cents,
      online_total_cents: upcomingCourse.price_cents,
      platform_fee_cents: 2500,
      escrow_status: "held",
      deposit_status: "held_in_escrow",
    });
    if (ube) console.error("seed: upcoming backdoor booking failed", ube.message);
  }

  // ---- 20 mock students (10 attended this month + 10 active/reserved) ----
  let mockStudentsCreated = 0;
  const stamp = Date.now().toString(36);
  const reviewComments = [
    "Marcus runs a tight class — zero ego, max reps. Took my draw time down half a second in one weekend.",
    "Real-world drills, not square-range theatre. Worth every dollar.",
    "Best money I've spent on training this year. Coming back for the CQB course.",
    "Patient with new shooters but won't let bad habits slide. Exactly what I needed.",
    "TCCC content was no-joke — pulled straight from current battlefield medicine.",
    "Instruction was clear, direct, and safe. Solid coaching on grip and trigger press.",
    "Felt like getting reps with a buddy who happens to be a Ranger. Highly recommend.",
  ];

  for (let i = 0; i < MOCK_STUDENT_NAMES.length; i++) {
    const name = MOCK_STUDENT_NAMES[i];
    const email = `${MOCK_STUDENT_EMAIL_PREFIX}${stamp}-${i}@taclink.test`;
    const { data: created, error: cerr } = await admin.auth.admin.createUser({
      email,
      password: `Mock!${stamp}${i}A1`,
      email_confirm: true,
      user_metadata: {
        role: "student",
        display_name: name,
        is_test_account: true,
      },
    });
    if (cerr || !created.user) {
      console.error("seed: mock student create failed", cerr?.message);
      continue;
    }
    const mockId = created.user.id;

    await admin.from("test_accounts").insert({
      user_id: mockId,
      email,
      role: "student",
      label: MOCK_STUDENT_LABEL,
      created_by: adminUserId,
    });

    await admin.from("user_roles").upsert(
      { user_id: mockId, role: "student" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );

    const photo = MOCK_STUDENT_PHOTOS[i % MOCK_STUDENT_PHOTOS.length];
    await admin.from("profiles").upsert(
      {
        id: mockId,
        display_name: name,
        photo_url: `https://images.unsplash.com/${photo}?w=400&h=400&fit=crop&crop=faces`,
        state: "TX",
        service_state: "TX",
        service_city: "Austin",
        subscription_status: "free",
        onboarding_started_at: new Date(now - (20 - i) * day).toISOString(),
        onboarding_completed_at: new Date(now - (20 - i) * day + 3600000).toISOString(),
        policy_acknowledged_at: new Date(now - (20 - i) * day + 3600000).toISOString(),
      },
      { onConflict: "id" },
    );

    const isAttended = i < 10; // first 10 = attended this month, last 10 = active/reserved
    const course = isAttended
      ? (pastCourse ?? insertedCourses[0])
      : upcomingCourses[i % Math.max(upcomingCourses.length, 1)] ?? insertedCourses[0];
    if (!course) continue;

    if (isAttended) {
      // Attended within the last ~28 days (this month)
      const bookedAt = new Date(now - (25 - i) * day);
      const attendedAt = new Date(now - (14 - i) * day);
      const { error: be } = await admin.from("bookings").insert({
        student_id: mockId,
        course_id: course.id,
        status: "attended",
        booked_at: bookedAt.toISOString(),
        attended_at: attendedAt.toISOString(),
        course_price_cents: course.price_cents,
        online_total_cents: course.price_cents,
        platform_fee_cents: 2500,
        escrow_status: "released",
        deposit_status: "released",
      });
      if (be) {
        console.error("seed: mock attended booking failed", be.message);
        continue;
      }

      // ~70% of attended students leave a review
      if (i % 10 < 7) {
        await admin.from("reviews").insert({
          course_id: course.id,
          instructor_id: instructorId,
          student_id: mockId,
          rating: i % 7 === 0 ? 4 : 5,
          comment: reviewComments[i % reviewComments.length],
        });
      }
    } else {
      // Reserved for upcoming course this month
      const bookedAt = new Date(now - (i - 9) * day);
      const { error: be } = await admin.from("bookings").insert({
        student_id: mockId,
        course_id: course.id,
        status: "reserved",
        booked_at: bookedAt.toISOString(),
        course_price_cents: course.price_cents,
        online_total_cents: course.price_cents,
        platform_fee_cents: 2500,
        escrow_status: "held",
        deposit_status: "held_in_escrow",
      });
      if (be) {
        console.error("seed: mock reserved booking failed", be.message);
        continue;
      }
    }

    mockStudentsCreated++;
  }

  return {
    courses_created: insertedCourses.length,
    mock_students_created: mockStudentsCreated,
  };
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
      // Then auto-seed advertising-quality mock data (profile photo, courses,
      // credential, bookings, review) so the accounts are demo-ready on first use.
      const results: Array<{ role: string; email: string; password: string }> = [];
      const ids: { instructor?: string; student?: string } = {};
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

        ids[role] = userIdForRole;

        // Baseline profile (will be enriched by seedBackdoorMockData below)
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

      // Auto-seed mock data so the accounts are demo-ready immediately.
      let seeded: { courses_created: number } | null = null;
      if (ids.instructor && ids.student) {
        try {
          seeded = await seedBackdoorMockData(admin, ids.instructor, ids.student);
        } catch (e) {
          console.error("ensure_backdoor: auto-seed failed", (e as Error).message);
        }
      }

      return json({ ok: true, backdoor: results, seeded });
    }

    if (body.action === "seed_mock_data") {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (listErr) throw listErr;
      const findUser = (email: string) =>
        list.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
      const instr = findUser(BACKDOOR.instructor.email);
      const stud = findUser(BACKDOOR.student.email);
      if (!instr || !stud) {
        return json(
          { error: "Backdoor accounts not provisioned. Click 'Create / reset backdoor' first." },
          400,
        );
      }
      const result = await seedBackdoorMockData(admin, instr.id, stud.id);
      return json({
        ok: true,
        instructor_id: instr.id,
        student_id: stud.id,
        ...result,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("manage-test-accounts error", e);
    return json({ error: (e as Error).message ?? "Internal error" }, 500);
  }
});
