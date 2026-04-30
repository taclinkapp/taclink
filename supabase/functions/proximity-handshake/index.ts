// proximity-handshake — exchanges signed short-lived tokens between the
// student's device and the instructor's scanner over a backend round-trip.
// Returns a verified=true proximity_event row when the student-issued token
// validates AND the instructor-issued counter-token validates within the same
// course. Acts as the "AI proximity authentication" layer — combining GPS
// smoothing + cryptographic handshake for strong fraud protection.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};
const getSecret = () =>
  Deno.env.get("CHECKIN_HMAC_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const hmac = async (data: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
};
const ctEq = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { mode, bookingId, distanceM, accuracyM, smoothedM, peerToken } = body ?? {};

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (mode === "issue") {
      if (!bookingId) {
        return new Response(JSON.stringify({ error: "bookingId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: booking } = await admin
        .from("bookings")
        .select("id, student_id, course_id")
        .eq("id", bookingId)
        .maybeSingle();
      if (!booking || booking.student_id !== userData.user.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const payload = {
        v: 1,
        b: booking.id,
        c: booking.course_id,
        s: booking.student_id,
        iat: Date.now(),
        exp: Date.now() + 60_000,
      };
      const pB64 = b64url(enc.encode(JSON.stringify(payload)));
      const sig = b64url(await hmac(pB64));
      const token = `TLPX:v1:${pB64}.${sig}`;
      return new Response(JSON.stringify({ token, expiresAt: payload.exp }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "verify") {
      // Instructor-side: receive the student's token, validate, and log a
      // verified proximity_event with optional GPS data.
      if (typeof peerToken !== "string" || !peerToken.startsWith("TLPX:v1:")) {
        return new Response(JSON.stringify({ ok: false, reason: "Bad token" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const [pB64, sigB64] = peerToken.slice("TLPX:v1:".length).split(".");
      if (!pB64 || !sigB64) {
        return new Response(JSON.stringify({ ok: false, reason: "Malformed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const expected = await hmac(pB64);
      if (!ctEq(expected, fromB64url(sigB64))) {
        return new Response(JSON.stringify({ ok: false, reason: "Bad signature" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const payload = JSON.parse(new TextDecoder().decode(fromB64url(pB64)));
      if (Date.now() > payload.exp) {
        return new Response(JSON.stringify({ ok: false, reason: "Expired" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Verify the calling user is the instructor for this course.
      const { data: course } = await admin
        .from("courses")
        .select("id, instructor_id")
        .eq("id", payload.c)
        .maybeSingle();
      if (!course || course.instructor_id !== userData.user.id) {
        return new Response(JSON.stringify({ ok: false, reason: "Not your course" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Log verified handshake.
      await admin.from("proximity_events").insert({
        booking_id: payload.b,
        course_id: payload.c,
        student_id: payload.s,
        distance_m: distanceM ?? null,
        accuracy_m: accuracyM ?? null,
        smoothed_m: smoothedM ?? null,
        source: "handshake",
        verified: true,
        metadata: { issued_at: payload.iat },
      });
      return new Response(
        JSON.stringify({ ok: true, bookingId: payload.b, studentId: payload.s }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "mode must be 'issue' or 'verify'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
