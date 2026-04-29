// AI proposer — generates a proposed action and queues it in ai_actions.
// Called by triggers, schedules, or other edge functions whenever something
// happens that an AI should look at (new message, new credential upload,
// new course, refund request, etc.).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Kind =
  | "message_reply"
  | "support_reply"
  | "credential_verify"
  | "course_moderation"
  | "review_moderation"
  | "refund_recommendation"
  | "instructor_nudge";

interface ProposeBody {
  kind: Kind;
  target_type?: string;
  target_id?: string;
  // Free-form context the AI should use to reason about the action.
  context: Record<string, unknown>;
}

const SYSTEM_PROMPTS: Record<Kind, string> = {
  message_reply: `You are the TacLink owner's AI assistant. You draft a reply on behalf of the platform/owner to a message between a student and an instructor when the recipient hasn't responded.
Rules:
- Tone: professional, friendly, concise (2–4 sentences).
- Never make commitments about pricing, refunds, schedules, gear lists, or instruction unless the context explicitly supports it.
- If the message is a basic FAQ (logistics, what to bring, parking, payment confirmation), draft a confident reply.
- If it asks something only the instructor can answer, draft a polite "I'll get back to you shortly" placeholder and mark risk_level "medium".
- Never include phone numbers, emails, or external links.
Return JSON via the propose_action tool.`,
  support_reply: `You are the TacLink owner's AI support agent. Draft a reply to a support ticket.
- Be empathetic, specific, and actionable.
- If you can fully resolve it from the context, reply with the answer (low risk).
- If it requires a refund, account change, or policy exception, draft the reply but mark risk_level "high".
Return JSON via the propose_action tool.`,
  credential_verify: `You are reviewing an instructor credential upload. Based on the AI OCR/analysis context provided, recommend a status: "verified", "needs_more_info", or "rejected".
- Mark risk_level "low" only if confidence ≥ 0.85 and document is clearly valid and unexpired.
- Mark "high" if the credential looks suspicious, expired, or unreadable.
Return JSON via the propose_action tool.`,
  course_moderation: `You moderate a new/updated course listing. Recommend "approve", "approve_with_edits" (and provide cleaned title/description), or "reject" (with reason).
- Reject: hate, illegal activity, doxxing, contact-info bypass, prohibited content.
- Edit: minor spelling/clarity, removing contact info.
- Mark risk_level "high" for any rejection.
Return JSON via the propose_action tool.`,
  review_moderation: `You moderate a student review. Recommend "approve", "redact" (and provide cleaned text), or "reject".
- Reject: profanity attacks, doxxing, off-topic, fake reviews.
Return JSON via the propose_action tool.`,
  refund_recommendation: `Given the booking context, recommend "approve_full", "approve_partial" (with amount_cents), or "deny" with a one-sentence reason. Mark risk_level "high" for anything over $100 or any denial.
Return JSON via the propose_action tool.`,
  instructor_nudge: `Given the instructor activity context, draft a short in-app nudge message (1–2 sentences) to encourage them to take a specific next step (publish first course, complete payout setup, respond to pending student message, etc). Risk: low.
Return JSON via the propose_action tool.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as ProposeBody;
    if (!body?.kind || !body?.context) {
      return json({ error: "kind and context are required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const system = SYSTEM_PROMPTS[body.kind];
    if (!system) return json({ error: `unknown kind: ${body.kind}` }, 400);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Context:\n${JSON.stringify(body.context, null, 2)}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "propose_action",
              description: "Propose an action for the platform owner to approve.",
              parameters: {
                type: "object",
                properties: {
                  preview: { type: "string", description: "1-line human summary of the proposed action" },
                  reasoning: { type: "string", description: "Why this action is recommended" },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  risk_level: { type: "string", enum: ["low", "medium", "high"] },
                  payload: {
                    type: "object",
                    description: "The actual action to execute if approved (e.g. { reply_text: '...', recipient_role: 'student' } for message_reply, or { decision: 'verified' } for credential_verify)",
                    additionalProperties: true,
                  },
                },
                required: ["preview", "reasoning", "confidence", "risk_level", "payload"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "propose_action" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return json({ error: "rate_limit" }, 429);
      if (aiResp.status === 402) return json({ error: "credits_exhausted" }, 402);
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return json({ error: "ai_gateway_error" }, 500);
    }

    const data = await aiResp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return json({ error: "no tool call returned" }, 500);

    const args = JSON.parse(call.function.arguments);

    // Default status: auto-pause high-risk or low-confidence; otherwise proposed.
    let status =
      args.risk_level === "high" || (args.confidence ?? 0) < 0.6
        ? "auto_paused"
        : "proposed";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check trust settings — does this kind/risk/confidence qualify for auto-approve?
    let autoApproved = false;
    try {
      const { data: settings } = await supabase
        .from("ai_auto_approve_settings")
        .select("rules")
        .eq("id", 1)
        .maybeSingle();
      const rule = settings?.rules?.[body.kind];
      if (rule?.enabled && status === "proposed") {
        const riskOk =
          rule.max_risk === "medium"
            ? args.risk_level !== "high"
            : args.risk_level === "low";
        const confOk = (args.confidence ?? 0) >= (rule.min_confidence ?? 0.85);
        if (riskOk && confOk) {
          status = "approved";
          autoApproved = true;
        }
      }
    } catch (e) {
      console.error("auto-approve check failed", e);
    }

    const { data: row, error } = await supabase
      .from("ai_actions")
      .insert({
        kind: body.kind,
        status,
        confidence: args.confidence,
        risk_level: args.risk_level,
        target_type: body.target_type ?? null,
        target_id: body.target_id ?? null,
        payload: args.payload,
        preview: args.preview,
        reasoning: args.reasoning,
        model: "google/gemini-3-flash-preview",
        auto_approved: autoApproved,
      })
      .select()
      .single();

    if (error) {
      console.error("insert ai_actions error", error);
      return json({ error: error.message }, 500);
    }

    // If auto-approved, immediately invoke ai-execute (fire-and-forget).
    if (autoApproved && row) {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        await fetch(`${SUPABASE_URL}/functions/v1/ai-execute-internal`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ action_id: row.id }),
        });
      } catch (e) {
        console.error("auto-execute trigger failed", e);
      }
    }

    return json({ action: row, auto_approved: autoApproved });
  } catch (e) {
    console.error("ai-propose error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
