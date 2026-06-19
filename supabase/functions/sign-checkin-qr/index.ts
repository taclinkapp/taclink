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

const randomSixDigitCode = () => {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1_000_000).padStart(6, "0");
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
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!bearer) {
      console.warn("sign-checkin-qr: missing bearer token");
      return new Response(JSON.stringify({ error: "Missing auth token — please sign in again." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // getClaims validates the JWT locally (no extra network round-trip), which
    // avoids transient 401s when the auth API is briefly slow/unreachable.
    // Fallback to getUser() if claims aren't returned (e.g. legacy HS256 key).
    let userId: string | null = null;
    try {
      const { data: claimsData } = await (supabase.auth as any).getClaims?.(bearer) ?? { data: null };
      if (claimsData?.claims?.sub) userId = claimsData.claims.sub as string;
    } catch (e) {
      console.warn("sign-checkin-qr: getClaims failed", String(e));
    }
    if (!userId) {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) {
        console.warn("sign-checkin-qr: auth.getUser failed", userErr?.message);
        return new Response(JSON.stringify({ error: "Session expired — please sign in again." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = userData.user.id;
    }

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
      .select("id, student_id, course_id, status, deposit_status")
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
    // Don't mint check-in QRs for bookings that aren't live.
    if (booking.status !== "reserved" && booking.status !== "attended") {
      return new Response(JSON.stringify({ error: "Booking is not active" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (
      booking.deposit_status !== "held_in_escrow" &&
      booking.deposit_status !== "confirmed" &&
      booking.deposit_status !== "released"
    ) {
      return new Response(JSON.stringify({ error: "Deposit not settled — check-in QR unavailable" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: course } = await admin
      .from("courses")
      .select("id, starts_at, ends_at")
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

    // Manual fallback 6-digit code — rotates every time a fresh QR is issued.
    // We store only an HMAC fingerprint so verify-checkin-code can accept the
    // latest shown code without persisting the readable number.
    let manualCode: string | null = null;
    let manualCodeAvailableAt: string | null = null;
    if (course?.starts_at) {
      const startMs = new Date(course.starts_at).getTime();
      const endMs = course.ends_at ? new Date(course.ends_at).getTime() : startMs + 8 * 60 * 60 * 1000;
      const WINDOW_OPEN = startMs - 30 * 60 * 1000;
      const WINDOW_CLOSE = endMs + 12 * 60 * 60 * 1000;
      manualCodeAvailableAt = new Date(WINDOW_OPEN).toISOString();
      const now = Date.now();
      if (now >= WINDOW_OPEN && now <= WINDOW_CLOSE) {
        const { data: existingCode } = await admin
          .from("checkin_manual_codes")
          .select("code_hash")
          .eq("booking_id", booking.id)
          .maybeSingle();
        for (let attempt = 0; attempt < 8 && !manualCode; attempt++) {
          const candidate = randomSixDigitCode();
          const codeHash = b64url(await hmac(`MCH:${booking.course_id}:${candidate}`));
          if (existingCode?.code_hash === codeHash) continue;
          const { error: upsertErr } = await admin
            .from("checkin_manual_codes")
            .upsert({
              booking_id: booking.id,
              course_id: booking.course_id,
              student_id: booking.student_id,
              code_hash: codeHash,
              issued_at: new Date(issuedAt).toISOString(),
              expires_at: new Date(Math.min(expiresAt, WINDOW_CLOSE)).toISOString(),
              consumed_at: null,
            }, { onConflict: "booking_id" });

          if (!upsertErr) {
            manualCode = candidate;
          } else if (!/duplicate key|unique/i.test(upsertErr.message ?? "")) {
            throw upsertErr;
          }
        }
        if (!manualCode) throw new Error("Could not generate a fresh backup code. Please refresh again.");
      }
    }

    return new Response(
      JSON.stringify({ token, expiresAt, day, manualCode, manualCodeAvailableAt }),
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
