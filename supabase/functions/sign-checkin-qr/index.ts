// Issues a cryptographically signed check-in QR payload bound to:
//   bookingId | courseId | YYYY-MM-DD (course local day)
// Format: TLCI:v2:<base64url(payload)>.<base64url(hmacSha256)>
//
// The student requests a fresh signature; the instructor scanner verifies it
// using the verify-checkin-qr function. The HMAC secret never leaves the server.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const enc = new TextEncoder();

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

const dayKey = (iso: string | null) => {
  // YYYY-MM-DD in UTC. Falls back to today if no course date.
  const d = iso ? new Date(iso) : new Date();
  return d.toISOString().slice(0, 10);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { bookingId } = await req.json().catch(() => ({}));
    if (!bookingId || typeof bookingId !== "string") {
      return new Response(JSON.stringify({ error: "bookingId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the requesting user owns this booking and load the course day.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select("id, student_id, course_id")
      .eq("id", bookingId)
      .maybeSingle();
    if (bErr || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (booking.student_id !== userId) {
      return new Response(JSON.stringify({ error: "Not your booking" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: course } = await admin
      .from("courses")
      .select("id, starts_at")
      .eq("id", booking.course_id)
      .maybeSingle();

    const day = dayKey(course?.starts_at ?? null);
    const issuedAt = Date.now();
    // Short TTL — payload also re-fetched periodically by the client.
    const expiresAt = issuedAt + 5 * 60 * 1000;

    const payload = {
      v: 2,
      b: booking.id,
      c: booking.course_id,
      d: day,
      iat: issuedAt,
      exp: expiresAt,
    };
    const payloadJson = JSON.stringify(payload);
    const payloadB64 = b64url(enc.encode(payloadJson));
    const sigBytes = await hmac(payloadB64);
    const sigB64 = b64url(sigBytes);
    const token = `TLCI:v2:${payloadB64}.${sigB64}`;

    return new Response(
      JSON.stringify({ token, expiresAt, day }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
