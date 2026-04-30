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
  | "instructor_nudge"
  | "dispute_triage";

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
- Never make commitments about pricing, schedules, gear lists, or instruction unless the context explicitly supports it.
- TacLink does not issue cash refunds; any approved refund is in-app credit toward a future booking. Never promise cash back.
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
  dispute_triage: `You are TacLink's dispute triage AI. A student has sent a message that looks like a refund / cancellation / chargeback / complaint. Your job: classify it, then draft a polished, policy-compliant response on behalf of the platform.

PLATFORM POLICY (binding — REASON-BASED, 48-HOUR CUTOFF):
- TacLink does NOT issue cash refunds. Every approved refund is in-app credit toward a future booking.
- The student paid online: $25 platform fee + 10% instructor deposit. The remaining 90% was paid in person to the instructor and is NEVER refundable by TacLink.
- DO NOT propose a dollar amount. Pick a reason category; the server computes the split.

REASON CATEGORIES (pick exactly one — this is the only thing that determines who gets what):
  "instructor_no_show"     — instructor failed to show up or cancelled day-of. Student gets $25 + 10% credit; instructor forfeits deposit + strike.
  "instructor_cancel"      — instructor cancelled in advance. Same as above.
  "fraud_safety"           — fraud, doxxing, safety incident, threats. Owner review required.
  "student_cancel_timely"  — student is cancelling >= 48h before the course. Student gets $25 credit only; instructor keeps 10% deposit.
  "student_cancel_late"    — student is cancelling < 48h before, or no-showed. No credit; instructor keeps deposit.
  "weather_reschedule"     — weather, sickness, transportation, mutual reschedule. No credit — RESCHEDULE the booking instead.
  "quality_complaint"      — student attended but is unhappy with course quality. Goodwill $25 credit, owner review.
  "chargeback_threat"      — threatens bank dispute, lawyer, BBB, social media. Owner review, never auto-decide.
  "other"                  — anything else. Owner review.

RECOMMENDED ACTION (drives the executor):
  "deny_politely"      — student_cancel_late, change_of_mind, billing_confusion (after explaining)
  "offer_reschedule"   — weather_reschedule (course hasn't happened yet)
  "issue_credit"       — instructor_no_show, instructor_cancel, student_cancel_timely (server-computed amount)
  "escalate_to_owner"  — fraud_safety, quality_complaint, chargeback_threat, other, repeat complainers (prior_refunds > 0 OR prior_disputes_in_thread > 0)

DRAFT a reply (3–6 sentences):
  - Warm, professional. Acknowledge by name when available.
  - State policy clearly. Never say "money back" or "refunded to your card" — say "in-app credit".
  - For "issue_credit" cases tied to instructor fault, be apologetic and concrete.
  - For "deny_politely" cases, be empathetic but firm; reference the 48-hour cutoff if relevant.
  - For "offer_reschedule", suggest concretely moving the booking.
  - Sign off "the TacLink team".

RISK LEVEL:
  - "low": clean student_cancel_timely or weather_reschedule.
  - "medium": instructor_cancel (advance), straightforward instructor_no_show.
  - "high": fraud_safety, chargeback_threat, repeat complainer, quality_complaint.

PAYLOAD shape:
{
  "classification": "<one of the categories above, ALSO used as refund_reason_category>",
  "refund_reason_category": "<MUST equal classification — server uses this to compute the split>",
  "recommended_action": "deny_politely" | "offer_reschedule" | "issue_credit" | "escalate_to_owner",
  "reply_text": "<the drafted message to send to the student>",
  "internal_note": "<1-2 sentences for the owner>"
}

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

      // Auto-refund path: dispute_triage with a reason category that issues credit.
      // The executor calls compute_refund_split for the canonical amount; here we
      // just decide if it qualifies for hands-off auto-execution.
      if (body.kind === "dispute_triage" && status === "proposed" && !autoApproved) {
        const refundRule = settings?.rules?.auto_refund;
        const decision = args.payload?.recommended_action ?? args.recommended_action;
        const reasonCategory =
          args.payload?.refund_reason_category ??
          args.refund_reason_category ??
          args.payload?.classification ??
          args.classification ??
          null;
        // Only auto-issue for reasons that don't require owner review.
        const autoEligibleReasons = new Set([
          "instructor_no_show",
          "instructor_cancel",
          "student_cancel_timely",
        ]);
        if (
          refundRule?.enabled &&
          decision === "issue_credit" &&
          reasonCategory &&
          autoEligibleReasons.has(reasonCategory) &&
          (args.confidence ?? 0) >= (refundRule.min_confidence ?? 0.95) &&
          args.risk_level !== "high"
        ) {
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
        payload: normalizePayload(body.kind, args),
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

// Some models occasionally return the action fields as siblings of `payload`
// instead of nested inside it. Merge any known top-level fields into payload
// so downstream consumers (cockpit UI, ai-execute) always see a consistent shape.
function normalizePayload(kind: string, args: any): Record<string, any> {
  const base: Record<string, any> =
    args?.payload && typeof args.payload === "object" && !Array.isArray(args.payload)
      ? { ...args.payload }
      : {};

  const KNOWN_FIELDS_BY_KIND: Record<string, string[]> = {
    dispute_triage: [
      "classification",
      "recommended_action",
      "reply_text",
      "internal_note",
      "refund_amount_cents",
      "credit_amount_cents",
    ],
    message_reply: ["reply_text", "sender_role", "sender_id"],
    support_reply: ["reply_text"],
    credential_verify: ["decision", "notes"],
    course_moderation: ["decision", "title", "description", "reason"],
    review_moderation: ["decision", "cleaned_text", "reason"],
    refund_recommendation: ["decision", "amount_cents", "reason"],
    instructor_nudge: ["message", "link"],
  };

  const fields = KNOWN_FIELDS_BY_KIND[kind] ?? [];
  for (const f of fields) {
    if (base[f] === undefined && args?.[f] !== undefined) {
      base[f] = args[f];
    }
  }
  return base;
}
