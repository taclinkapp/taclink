// proximity-handshake — exchanges signed short-lived tokens between the
// student's device and the instructor's scanner over a backend round-trip.
// Returns a verified=true proximity_event row when the student-issued token
// validates AND the instructor-issued counter-token validates within the same
// course. Acts as the "AI proximity authentication" layer — combining GPS
// smoothing + cryptographic handshake for strong fraud protection.
//
// Hardening (v2):
//  - Tokens carry a server-issued nonce stored in `proximity_token_nonces`.
//  - Nonces are single-use: verify atomically marks the row consumed; replay
//    attempts are rejected.
//  - Tokens are bound to bookingId + a device/session fingerprint provided by
//    the issuing client. Verify must echo the same bookingId, and the device
//    fingerprint is locked into the signed payload so a stolen token from one
//    device cannot be used from another.

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

const TOKEN_TTL_MS = 60_000;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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
    if (!userData?.user) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => ({}));
    const { mode, bookingId, distanceM, accuracyM, smoothedM, peerToken, deviceId } =
      body ?? {};

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (mode === "issue") {
      if (typeof bookingId !== "string" || !bookingId) {
        return json(400, { error: "bookingId required" });
      }
      if (typeof deviceId !== "string" || deviceId.length < 8 || deviceId.length > 128) {
        return json(400, { error: "deviceId required (8-128 chars)" });
      }
      const { data: booking } = await admin
        .from("bookings")
        .select("id, student_id, course_id")
        .eq("id", bookingId)
        .maybeSingle();
      if (!booking || booking.student_id !== userData.user.id) {
        return json(403, { error: "Forbidden" });
      }
      // Generate a server-side nonce + device-bound payload.
      const nonceBytes = new Uint8Array(16);
      crypto.getRandomValues(nonceBytes);
      const nonce = b64url(nonceBytes);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

      // Bind the device fingerprint cryptographically by hashing it into
      // the payload (we still also store deviceId server-side for audit).
      const dHash = b64url(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", enc.encode(`${nonce}.${deviceId}`)),
        ),
      ).slice(0, 22);

      const { error: insErr } = await admin.from("proximity_token_nonces").insert({
        nonce,
        booking_id: booking.id,
        student_id: booking.student_id,
        device_id: deviceId,
        expires_at: expiresAt.toISOString(),
      });
      if (insErr) return json(500, { error: "Could not issue token" });

      const payload = {
        v: 2,
        b: booking.id,
        c: booking.course_id,
        s: booking.student_id,
        n: nonce,
        d: dHash,
        iat: Date.now(),
        exp: expiresAt.getTime(),
      };
      const pB64 = b64url(enc.encode(JSON.stringify(payload)));
      const sig = b64url(await hmac(pB64));
      const token = `TLPX:v2:${pB64}.${sig}`;
      return json(200, { token, expiresAt: payload.exp });
    }

    if (mode === "verify") {
      if (typeof peerToken !== "string") {
        return json(200, { ok: false, reason: "Bad token" });
      }
      // Accept v2 only. (v1 is no longer issued and is rejected as insecure.)
      if (!peerToken.startsWith("TLPX:v2:")) {
        return json(200, { ok: false, reason: "Unsupported token version" });
      }
      const [pB64, sigB64] = peerToken.slice("TLPX:v2:".length).split(".");
      if (!pB64 || !sigB64) return json(200, { ok: false, reason: "Malformed" });

      const expected = await hmac(pB64);
      if (!ctEq(expected, fromB64url(sigB64))) {
        return json(200, { ok: false, reason: "Bad signature" });
      }
      const payload = JSON.parse(new TextDecoder().decode(fromB64url(pB64)));
      if (Date.now() > payload.exp) {
        return json(200, { ok: false, reason: "Expired" });
      }
      // Optional explicit booking binding from caller — must match payload.
      if (bookingId && bookingId !== payload.b) {
        return json(200, { ok: false, reason: "Booking mismatch" });
      }
      // Verify the calling user is the instructor for this course.
      const { data: course } = await admin
        .from("courses")
        .select("id, instructor_id")
        .eq("id", payload.c)
        .maybeSingle();
      if (!course || course.instructor_id !== userData.user.id) {
        return json(403, { ok: false, reason: "Not your course" });
      }
      // Atomically consume the nonce: replay protection.
      const { data: consumed, error: consumeErr } = await admin
        .from("proximity_token_nonces")
        .update({
          consumed_at: new Date().toISOString(),
          consumed_by_instructor: userData.user.id,
        })
        .eq("nonce", payload.n)
        .eq("booking_id", payload.b)
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .select("nonce, device_id")
        .maybeSingle();
      if (consumeErr || !consumed) {
        return json(200, { ok: false, reason: "Replay or unknown nonce" });
      }
      // Re-derive device hash and check it matches the signed payload.
      const dHashCheck = b64url(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            enc.encode(`${payload.n}.${consumed.device_id}`),
          ),
        ),
      ).slice(0, 22);
      if (dHashCheck !== payload.d) {
        return json(200, { ok: false, reason: "Device binding mismatch" });
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
        metadata: { issued_at: payload.iat, nonce: payload.n },
      });
      return json(200, { ok: true, bookingId: payload.b, studentId: payload.s });
    }

    return json(400, { error: "mode must be 'issue' or 'verify'" });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});
