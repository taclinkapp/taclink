import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";

async function sha256(input: string) {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function normalizePhone(raw: string) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return "+" + digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { phone } = await req.json();
    const normalized = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      return new Response(JSON.stringify({ error: "Invalid phone number" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const FROM = Deno.env.get("TWILIO_FROM_NUMBER");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !FROM) {
      return new Response(JSON.stringify({ error: "SMS not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Rate limit: max 5 codes per phone per hour
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin
      .from("phone_verifications")
      .select("id", { count: "exact", head: true })
      .eq("phone", normalized)
      .gte("created_at", oneHourAgo);
    if ((count ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: "Too many codes requested. Try again later." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_hash = await sha256(code + ":" + normalized);
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insErr } = await admin.from("phone_verifications").insert({
      phone: normalized, code_hash, expires_at,
    });
    if (insErr) throw insErr;

    const smsRes = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: normalized, From: FROM,
        Body: `Your TacLink verification code is ${code}. It expires in 10 minutes.`,
      }),
    });
    const smsData = await smsRes.json();
    if (!smsRes.ok) {
      console.error("Twilio error", smsRes.status, smsData);
      return new Response(JSON.stringify({ error: smsData?.message || "Failed to send SMS" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, phone: normalized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
