// Verifies a 6-digit manual check-in code submitted by an instructor.
// Codes rotate whenever the student's QR is refreshed. sign-checkin-qr stores
// only an HMAC fingerprint of the latest 6-digit code, and this function checks
// that fingerprint before marking attendance.
//
// Window: codes are only accepted from 30 min before course start through
// 12h after course end, matching sign-checkin-qr.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const enc = new TextEncoder();

const getSecret = () =>
  Deno.env.get("CHECKIN_HMAC_SECRET") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";

const hmac = async (data: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return new Uint8Array(sig);
};

const b64url = (bytes: Uint8Array) => {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const studentNameFor = async (admin: any, studentId: string | null) => {
  if (!studentId) return null;
  const { data } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", studentId)
    .maybeSingle();
  return data?.display_name ?? null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    let userId: string | null = null;
    if (bearer) {
      try {
        const { data: claimsData } = await (supabase.auth as any).getClaims?.(bearer) ?? { data: null };
        if (claimsData?.claims?.sub) userId = claimsData.claims.sub as string;
      } catch { /* ignore */ }
    }
    if (!userId) {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id ?? null;
    }
    if (!userId) {
      return new Response(JSON.stringify({ ok: false, reason: "Session expired — please sign in again." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { courseId, code } = await req.json().catch(() => ({}));
    if (!courseId || typeof courseId !== "string") {
      return new Response(JSON.stringify({ ok: false, reason: "courseId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const cleanCode = String(code ?? "").replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      return new Response(JSON.stringify({ ok: false, reason: "Enter the 6-digit code shown on the student's screen." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify instructor owns this course.
    const { data: course } = await admin
      .from("courses")
      .select("id, instructor_id, starts_at, ends_at")
      .eq("id", courseId)
      .maybeSingle();
    if (!course) {
      return new Response(JSON.stringify({ ok: false, reason: "Course not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (course.instructor_id !== userId) {
      return new Response(JSON.stringify({ ok: false, reason: "Not your course" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce the same time window as sign-checkin-qr.
    if (course.starts_at) {
      const startMs = new Date(course.starts_at).getTime();
      const endMs = course.ends_at ? new Date(course.ends_at).getTime() : startMs + 8 * 60 * 60 * 1000;
      const now = Date.now();
      if (now < startMs - 30 * 60 * 1000) {
        return new Response(JSON.stringify({ ok: false, reason: "Manual codes activate 30 minutes before the course starts." }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (now > endMs + 12 * 60 * 60 * 1000) {
        return new Response(JSON.stringify({ ok: false, reason: "Check-in window has closed for this course." }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const codeHash = b64url(await hmac(`MCH:${courseId}:${cleanCode}`));
    const { data: codeRow, error: codeErr } = await admin
      .from("checkin_manual_codes")
      .select("booking_id")
      .eq("course_id", courseId)
      .eq("code_hash", codeHash)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (codeErr) {
      return new Response(JSON.stringify({ ok: false, reason: codeErr.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!codeRow) {
      return new Response(JSON.stringify({ ok: false, reason: "Code didn't match the latest backup code for this course. Ask the student to read the current code under their QR." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: b, error: bookingErr } = await admin
      .from("bookings")
      .select("id, status, student_id")
      .eq("id", codeRow.booking_id)
      .eq("course_id", courseId)
      .maybeSingle();

    if (bookingErr) {
      return new Response(JSON.stringify({ ok: false, reason: bookingErr.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!b || (b.status !== "reserved" && b.status !== "attended")) {
      return new Response(JSON.stringify({ ok: false, reason: "Booking is no longer active for this course." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studentName = await studentNameFor(admin, b.student_id ?? null);
        if (b.status === "attended") {
          return new Response(
            JSON.stringify({ ok: true, bookingId: b.id, status: "attended", alreadyAttended: true, studentName }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
          );
        }

    const { data: updated, error: updateErr } = await admin
      .from("bookings")
      .update({ status: "attended", attended_at: new Date().toISOString() })
      .eq("id", b.id)
      .eq("course_id", courseId)
      .eq("status", "reserved")
      .is("attended_at", null)
      .select("id, status")
      .maybeSingle();

    if (updateErr) {
      return new Response(JSON.stringify({ ok: false, reason: updateErr.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin
      .from("checkin_manual_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("booking_id", b.id);

    return new Response(
      JSON.stringify({
        ok: true,
        bookingId: b.id,
        status: updated?.status ?? "attended",
        checkedIn: !!updated,
        alreadyAttended: !updated,
        studentName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, reason: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
