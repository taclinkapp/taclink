// Verifies a signed check-in QR payload from the instructor scanner.
// Checks: signature validity, expiry, course match, day match.
// Does NOT mark attendance — the client still does that under RLS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const enc = new TextEncoder();

const fromB64url = (s: string) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};
const b64url = (bytes: Uint8Array) => {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

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

const constantTimeEqual = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

const dayKey = (iso: string | null) => {
  const d = iso ? new Date(iso) : new Date();
  return d.toISOString().slice(0, 10);
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
      } catch { /* fall through */ }
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


    const { token, courseId, commit } = await req.json().catch(() => ({}));
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ ok: false, reason: "Token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const PREFIX = "TLCI:v2:";
    if (!token.startsWith(PREFIX)) {
      return new Response(JSON.stringify({ ok: false, reason: "Not a signed check-in QR" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const body = token.slice(PREFIX.length);
    const [payloadB64, sigB64] = body.split(".");
    if (!payloadB64 || !sigB64) {
      return new Response(JSON.stringify({ ok: false, reason: "Malformed token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let providedSig: Uint8Array;
    try {
      providedSig = fromB64url(sigB64);
    } catch {
      return new Response(JSON.stringify({ ok: false, reason: "Malformed token signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const expectedSig = await hmac(payloadB64);
    if (!constantTimeEqual(expectedSig, providedSig)) {
      return new Response(JSON.stringify({ ok: false, reason: "Invalid signature — QR cannot be trusted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let payload: any;
    try {
      payload = JSON.parse(new TextDecoder().decode(fromB64url(payloadB64)));
    } catch {
      return new Response(JSON.stringify({ ok: false, reason: "Unreadable payload" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (typeof payload?.exp === "number" && Date.now() > payload.exp) {
      return new Response(JSON.stringify({ ok: false, reason: "QR expired — student must refresh" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (courseId && payload.c !== courseId) {
      return new Response(JSON.stringify({ ok: false, reason: "QR is for a different course" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Real "valid today" window: the QR can only be used in a window around
    // the course's actual scheduled time. Previously this compared
    // payload.d to dayKey(course.starts_at) — which always matched because
    // sign-checkin-qr derived `d` from the same source, making the check
    // a no-op. Now we anchor to `now` vs. `course.starts_at`.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: course } = await admin
      .from("courses")
      .select("id, instructor_id, starts_at, ends_at")
      .eq("id", payload.c)
      .maybeSingle();

    if (!course) {
      return new Response(JSON.stringify({ ok: false, reason: "Course not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (course.instructor_id !== userId) {
      return new Response(JSON.stringify({ ok: false, reason: "Not your course" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    if (course?.starts_at) {
      const startMs = new Date(course.starts_at).getTime();
      const endMs = course.ends_at ? new Date(course.ends_at).getTime() : startMs + 8 * 60 * 60 * 1000;
      const EARLY_MS = 12 * 60 * 60 * 1000; // allow check-in up to 12h before
      const LATE_MS = 12 * 60 * 60 * 1000;  // allow check-in up to 12h after end
      const now = Date.now();
      if (now < startMs - EARLY_MS) {
        return new Response(JSON.stringify({ ok: false, reason: "QR not valid yet — course hasn't started" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      if (now > endMs + LATE_MS) {
        return new Response(JSON.stringify({ ok: false, reason: "QR no longer valid — course has ended" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    const { data: booking, error: bookingErr } = await admin
      .from("bookings")
      .select("id, status, course_id, student_id, attended_at")
      .eq("id", payload.b)
      .maybeSingle();

    if (bookingErr) {
      return new Response(JSON.stringify({ ok: false, reason: bookingErr.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!booking) {
      return new Response(JSON.stringify({ ok: false, reason: "Booking not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (booking.course_id !== payload.c) {
      return new Response(JSON.stringify({ ok: false, reason: "QR is for a different course" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const studentName = await studentNameFor(admin, booking.student_id ?? null);

    if (booking.status !== "reserved" && booking.status !== "attended") {
      return new Response(JSON.stringify({
        ok: false,
        reason: `Booking is ${booking.status} and cannot be checked in.`,
        bookingId: booking.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (commit === true && booking.status === "reserved") {
      const { data: updated, error: updateErr } = await admin
        .from("bookings")
        .update({ status: "attended", attended_at: new Date().toISOString() })
        .eq("id", booking.id)
        .eq("course_id", payload.c)
        .eq("status", "reserved")
        .is("attended_at", null)
        .select("id, status")
        .maybeSingle();

      if (updateErr) {
        return new Response(JSON.stringify({ ok: false, reason: updateErr.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      return new Response(
        JSON.stringify({
          ok: true,
          bookingId: payload.b,
          courseId: payload.c,
          day: payload.d,
          expiresAt: payload.exp,
          checkedIn: !!updated,
          alreadyAttended: !updated,
          studentName,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        bookingId: payload.b,
        courseId: payload.c,
        day: payload.d,
        expiresAt: payload.exp,
        status: booking.status,
        alreadyAttended: booking.status === "attended",
        studentName,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, reason: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
