import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { phone, code } = await req.json();
    const normalized = normalizePhone(phone);
    if (!normalized || !/^\d{6}$/.test(String(code || ""))) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: rows, error } = await admin
      .from("phone_verifications")
      .select("*")
      .eq("phone", normalized)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = rows?.[0];
    if (!row) {
      return new Response(JSON.stringify({ error: "No active code. Request a new one." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Code expired. Request a new one." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (row.attempts >= 5) {
      return new Response(JSON.stringify({ error: "Too many attempts. Request a new code." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hash = await sha256(String(code) + ":" + normalized);
    if (hash !== row.code_hash) {
      await admin.from("phone_verifications").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return new Response(JSON.stringify({ error: "Incorrect code" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("phone_verifications").update({ verified_at: new Date().toISOString() }).eq("id", row.id);

    // Sign a short-lived verification token (HMAC) the client can pass back at signup
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const exp = Date.now() + 30 * 60 * 1000;
    const payload = `${normalized}:${exp}`;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const token = btoa(payload) + "." + btoa(String.fromCharCode(...new Uint8Array(sig)));

    return new Response(JSON.stringify({ ok: true, phone: normalized, token, expires_at: exp }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
