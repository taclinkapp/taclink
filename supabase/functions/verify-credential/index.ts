// AI credential verification.
// Downloads a credential file from the private `credentials` bucket, sends it
// to a vision-capable model, asks for issuer / holder / expiration / tampering
// signals, then writes results back to instructor_credentials.
// Auto-approves high-confidence (>=0.85) results; otherwise marks needs_review.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Body = { credentialId: string };

const TOOL = {
  type: "function",
  function: {
    name: "report_credential_check",
    description: "Assess authenticity of a firearms-training credential document.",
    parameters: {
      type: "object",
      properties: {
        is_credential: { type: "boolean", description: "True if image clearly shows a credential, license, ID card, or certificate." },
        confidence: { type: "number", description: "0..1 confidence the credential is authentic and currently valid." },
        issuer: { type: "string" },
        holder_name: { type: "string" },
        expires_on: { type: "string", description: "ISO date or empty if not visible." },
        tampering_signs: { type: "boolean" },
        reasons: { type: "string", description: "Short bullet-style notes." },
      },
      required: ["is_credential", "confidence", "issuer", "holder_name", "expires_on", "tampering_signs", "reasons"],
      additionalProperties: false,
    },
  },
};

const SYSTEM = `You are a credentials-verification assistant for TacLink, a US firearms-training booking platform. Instructors upload credentials such as: NRA Instructor Certification, state firearms instructor license, USCCA / USConcealed certificate, military DD-214 / CAC, law-enforcement ID, range safety officer card.

Inspect the image and assess:
- Is this clearly a credential / license / certificate (not a selfie, not a random photo)?
- Issuing organization, certificate holder name, expiration date if visible
- Visual tampering signs: mismatched fonts, photo-edit halos, wrong logo, blurred fields
- Authenticity confidence on a 0..1 scale (be conservative — when unsure, score lower)

If the image isn't a credential, set is_credential=false and confidence=0.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { credentialId } = (await req.json()) as Body;
    if (!credentialId) {
      return new Response(JSON.stringify({ error: "credentialId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cred, error: credErr } = await admin
      .from("instructor_credentials")
      .select("*")
      .eq("id", credentialId)
      .maybeSingle();
    if (credErr || !cred) {
      return new Response(JSON.stringify({ error: "Credential not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the signup name for name-match scoring
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, full_name, first_name, last_name")
      .eq("id", cred.instructor_id as string)
      .maybeSingle();

    const signupName = (
      (profile as any)?.full_name ||
      [((profile as any)?.first_name ?? ""), ((profile as any)?.last_name ?? "")].join(" ").trim() ||
      (profile as any)?.display_name ||
      ""
    ).toString().trim();

    // Signed URL so the AI can fetch the private file (1-hour TTL is plenty)
    const { data: signed, error: signErr } = await admin.storage
      .from("credentials")
      .createSignedUrl(cred.file_path as string, 3600);
    if (signErr || !signed?.signedUrl) {
      throw new Error(`Cannot sign URL: ${signErr?.message ?? "unknown"}`);
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Credential type the instructor selected: ${cred.credential_type}. Inspect the image and report.`,
              },
              { type: "image_url", image_url: { url: signed.signedUrl } },
            ],
          },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "report_credential_check" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway ${aiResp.status}`);
    }

    const data = await aiResp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI did not return a tool call");
    const result = JSON.parse(args);

    let status: string;
    if (!result.is_credential) {
      status = "rejected";
    } else if (result.tampering_signs) {
      status = "needs_review";
    } else if (typeof result.confidence === "number" && result.confidence >= 0.85) {
      status = "approved";
    } else {
      status = "needs_review";
    }

    const expiresOn =
      typeof result.expires_on === "string" && /^\d{4}-\d{2}-\d{2}/.test(result.expires_on)
        ? result.expires_on.slice(0, 10)
        : null;

    await admin
      .from("instructor_credentials")
      .update({
        status,
        ai_confidence: result.confidence ?? null,
        ai_issuer: result.issuer ?? null,
        ai_holder_name: result.holder_name ?? null,
        ai_expires_on: expiresOn,
        ai_reasons: result.reasons ?? null,
        ai_raw: data,
      })
      .eq("id", credentialId);

    return new Response(
      JSON.stringify({ status, ...result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("verify-credential error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
