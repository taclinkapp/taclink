// ai-execute-internal — service-role version of ai-execute used only by
// ai-propose when an action qualifies for auto-approval. Same execution
// logic as ai-execute, but no admin auth check (caller is the server).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require service-role bearer token to prevent abuse.
    const authHeader = req.headers.get("Authorization") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!authHeader.startsWith("Bearer ") || authHeader.slice(7) !== SERVICE_KEY) {
      return json({ error: "unauthorized" }, 401);
    }

    const { action_id } = await req.json();
    if (!action_id) return json({ error: "action_id required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY);

    const { data: action, error: fetchErr } = await admin
      .from("ai_actions")
      .select("*")
      .eq("id", action_id)
      .single();
    if (fetchErr || !action) return json({ error: "action not found" }, 404);
    if (action.status !== "approved") {
      return json({ error: `action is ${action.status}` }, 400);
    }

    const payload = action.edited_payload ?? action.payload ?? {};

    try {
      switch (action.kind) {
        case "message_reply": {
          const conversationId = action.target_id;
          if (!conversationId) throw new Error("missing conversation_id");
          const { data: conv } = await admin
            .from("conversations")
            .select("instructor_id, student_id")
            .eq("id", conversationId)
            .single();
          if (!conv) throw new Error("conversation not found");
          const senderRole = payload.sender_role ?? "instructor";
          const senderId =
            payload.sender_id ??
            (senderRole === "instructor" ? conv.instructor_id : conv.student_id);
          await admin.from("messages").insert({
            conversation_id: conversationId,
            sender_id: senderId,
            sender_role: senderRole,
            body: `${payload.reply_text}\n\n— sent on behalf of the team`,
          });
          break;
        }

        case "review_moderation": {
          const reviewId = action.target_id;
          if (!reviewId) throw new Error("missing review_id");
          if (payload.decision === "redact" && payload.cleaned_text) {
            await admin
              .from("reviews")
              .update({ comment: payload.cleaned_text })
              .eq("id", reviewId);
          } else if (payload.decision === "reject") {
            await admin.from("reviews").delete().eq("id", reviewId);
          }
          break;
        }

        case "instructor_nudge": {
          const instructorId = action.target_id;
          if (!instructorId) throw new Error("missing instructor_id");
          await admin.from("notifications").insert({
            recipient_id: instructorId,
            type: "ai_nudge",
            title: "Quick tip from TacLink",
            body: payload.message,
            link: payload.link ?? "/instructor/dashboard",
          });
          break;
        }

        case "dispute_triage": {
          // Auto-execute path for low-risk auto-refunds.
          // Gate: must be approve_full_refund OR offer_app_credit, with refund/credit amount,
          // and student risk score must be low enough.
          const conversationId = action.target_id;
          if (!conversationId) throw new Error("missing conversation_id");

          const { data: conv } = await admin
            .from("conversations")
            .select("instructor_id, student_id, booking_id")
            .eq("id", conversationId)
            .single();
          if (!conv) throw new Error("conversation not found");

          // Pull auto-refund settings
          const { data: settings } = await admin
            .from("ai_auto_approve_settings")
            .select("rules")
            .eq("id", 1)
            .maybeSingle();
          const rule = settings?.rules?.auto_refund ?? {};
          const maxAmount = rule.max_amount_cents ?? 5000;
          const maxRiskScore = rule.max_risk_score ?? 30;
          const windowHours = rule.dispute_window_hours ?? 24;

          const decision = payload.recommended_action;
          const isRefund = decision === "approve_full_refund" || decision === "offer_app_credit";
          const requested = payload.refund_amount_cents ?? payload.credit_amount_cents ?? 0;

          if (!isRefund || !conv.booking_id || requested <= 0) {
            throw new Error("dispute_triage not eligible for auto-refund (no amount or wrong action)");
          }
          if (requested > maxAmount) {
            throw new Error(`amount ${requested} exceeds auto-refund cap ${maxAmount}`);
          }

          const { data: b } = await admin
            .from("bookings")
            .select("student_id, online_total_cents, platform_fee_cents, deposit_amount_cents")
            .eq("id", conv.booking_id)
            .single();
          if (!b) throw new Error("booking not found");

          // Compute risk score
          const { data: riskRows } = await admin.rpc("compute_student_risk_score", {
            _student_id: b.student_id,
          });
          const risk = Array.isArray(riskRows) ? riskRows[0] : riskRows;
          const score = risk?.score ?? 50;
          const factors = risk?.factors ?? {};

          if (score > maxRiskScore) {
            throw new Error(`student risk score ${score} exceeds cap ${maxRiskScore} — escalating to owner`);
          }

          // Send the drafted reply
          if (payload.reply_text) {
            await admin.from("messages").insert({
              conversation_id: conversationId,
              sender_id: conv.instructor_id,
              sender_role: "instructor",
              body: `${payload.reply_text}\n\n— the TacLink team`,
            });
          }

          // Issue auto-refund credit with dispute window
          const windowUntil = new Date(Date.now() + windowHours * 3600 * 1000).toISOString();
          await admin.from("refunds").insert({
            booking_id: conv.booking_id,
            student_id: b.student_id,
            amount_cents: amount,
            reason: payload.internal_note ?? `Auto-issued credit (${payload.classification ?? "dispute"})`,
            refund_type: decision === "approve_full_refund" ? "full" : "goodwill",
            issued_by: b.student_id, // service-role insert; tracked as auto via flag
            notes: `AUTO-ISSUED. Risk score ${score}. Instructor may dispute within ${windowHours}h.`,
            auto_issued: true,
            risk_score: score,
            risk_factors: factors,
            dispute_window_until: windowUntil,
            ai_action_id: action.id,
          });

          await admin.from("notifications").insert([
            {
              recipient_id: b.student_id,
              type: "refund_issued",
              title: `In-app credit issued: $${(amount / 100).toFixed(2)}`,
              body: `A $${(amount / 100).toFixed(2)} credit has been added. Apply it to your next booking.`,
              link: `/student/booking/${conv.booking_id}`,
            },
            {
              recipient_id: conv.instructor_id,
              type: "auto_refund_issued",
              title: "Auto-credit issued — you have 24h to dispute",
              body: `An automatic $${(amount / 100).toFixed(2)} credit was issued to a student. If this isn't right, dispute it within 24h.`,
              link: `/instructor/dashboard`,
            },
          ]);
          break;
        }

        case "credential_verify":
        case "course_moderation":
        case "support_reply":
        case "refund_recommendation":
          throw new Error(`kind ${action.kind} not eligible for auto-execute`);

        default:
          throw new Error(`kind ${action.kind} not eligible for auto-execute`);
      }

      await admin
        .from("ai_actions")
        .update({
          status: "executed",
          executed_at: new Date().toISOString(),
        })
        .eq("id", action_id);

      return json({ ok: true });
    } catch (execErr) {
      const msg = execErr instanceof Error ? execErr.message : "exec failed";
      await admin
        .from("ai_actions")
        .update({ status: "failed", error: msg })
        .eq("id", action_id);
      return json({ error: msg }, 500);
    }
  } catch (e) {
    console.error("ai-execute-internal error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
