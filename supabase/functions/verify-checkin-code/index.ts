// Verifies a 6-digit manual check-in code submitted by an instructor.
// Codes are deterministic HMAC(secret, "MC:<bookingId>:<day>") truncated to 6
// digits. The function iterates the course's active bookings, recomputes each
// expected code, and returns the matching bookingId — so the manual code never
// has to be stored in the DB and can't be enumerated by a client.
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

const dayKey = (iso: string | null) => {
  const d = iso ? new Date(iso) : new Date();
  return d.toISOString().slice(0, 10);
};

const codeFor = async (bookingId: string, day: string) => {
  const mc = await hmac(`MC:${bookingId}:${day}`);
  const n = ((mc[0] << 24) | (mc[1] << 16) | (mc[2] << 8) | mc[3]) >>> 0;
  return String(n % 1_000_000).padStart(6, "0");
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

    const day = dayKey(course.starts_at);

    // Pull every booking on this course that could legitimately check in.
    const { data: bookings } = await admin
      .from("bookings")
      .select("id, status, student_id")
      .eq("course_id", courseId)
      .in("status", ["reserved", "attended"]);

    if (!bookings || bookings.length === 0) {
      return new Response(JSON.stringify({ ok: false, reason: "No active bookings on this course." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const b of bookings) {
      const expected = await codeFor(b.id, day);
      if (expected === cleanCode) {
        return new Response(
          JSON.stringify({ ok: true, bookingId: b.id, status: b.status }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }
    }

    return new Response(JSON.stringify({ ok: false, reason: "Code didn't match any student on this course." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, reason: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
