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
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ ok: false, reason: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { token, courseId } = await req.json().catch(() => ({}));
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

    const expectedSig = await hmac(payloadB64);
    const providedSig = fromB64url(sigB64);
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

    // Day binding — verify against the actual course's scheduled day.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: course } = await admin
      .from("courses")
      .select("id, starts_at")
      .eq("id", payload.c)
      .maybeSingle();
    const expectedDay = dayKey(course?.starts_at ?? null);
    if (payload.d !== expectedDay) {
      return new Response(JSON.stringify({ ok: false, reason: "QR is not valid today" }), {
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
