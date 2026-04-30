// ai-execute — executes an AI action that has been approved by the owner.
// Called from the Owner Console. Looks up the action, applies its payload to
// the right table, then marks the action executed.

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
    const { action_id } = await req.json();
    if (!action_id) return json({ error: "action_id required" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "missing auth" }, 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "admin only" }, 403);

    const { data: action, error: fetchErr } = await admin
      .from("ai_actions")
      .select("*")
      .eq("id", action_id)
      .single();
    if (fetchErr || !action) return json({ error: "action not found" }, 404);
    if (action.status !== "approved") {
      return json({ error: `action is ${action.status}, not approved` }, 400);
    }

    const payload = action.edited_payload ?? action.payload ?? {};

    try {
      switch (action.kind) {
        case "message_reply": {
          // payload: { reply_text, sender_role: 'instructor' | 'student', sender_id }
          const conversationId = action.target_id;
          if (!conversationId) throw new Error("missing conversation_id");
          const { data: conv } = await admin
            .from("conversations")
            .select("instructor_id, student_id")
            .eq("id", conversationId)
            .single();
          if (!conv) throw new Error("conversation not found");
          const replyText = (payload.reply_text ?? "").toString().trim();
          if (!replyText) throw new Error("missing reply_text");
          // Default: AI replies as the instructor (since most automation is the instructor falling behind).
          const senderRole = payload.sender_role ?? "instructor";
          const senderId =
            payload.sender_id ??
            (senderRole === "instructor" ? conv.instructor_id : conv.student_id);
          await admin.from("messages").insert({
            conversation_id: conversationId,
            sender_id: senderId,
            sender_role: senderRole,
            body: `${replyText}\n\n— sent on behalf of the team`,
          });
          break;
        }

        case "support_reply": {
          // payload: { reply_text } — appended as admin note for now (we don't have a support_messages table to write to publicly)
          const ticketId = action.target_id;
          if (!ticketId) throw new Error("missing ticket_id");
          await admin
            .from("issue_reports")
            .update({
              admin_notes: `[AI reply, approved by owner]\n${payload.reply_text}`,
              status: "in_progress",
            })
            .eq("id", ticketId);
          break;
        }

        case "credential_verify": {
          // payload: { decision: 'verified' | 'needs_more_info' | 'rejected', notes? }
          const credId = action.target_id;
          if (!credId) throw new Error("missing credential_id");
          const map: Record<string, string> = {
            verified: "verified",
            rejected: "rejected",
            needs_more_info: "pending",
          };
          await admin
            .from("instructor_credentials")
            .update({
              status: map[payload.decision] ?? "pending",
              admin_notes: payload.notes ?? null,
              reviewed_by: user.id,
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", credId);
          break;
        }

        case "course_moderation": {
          // payload: { decision, title?, description?, reason? }
          const courseId = action.target_id;
          if (!courseId) throw new Error("missing course_id");
          const update: Record<string, unknown> = {
            moderation_status:
              payload.decision === "reject" ? "rejected" : "approved",
            moderation_reason: payload.reason ?? null,
          };
          if (payload.title) update.title = payload.title;
          if (payload.description) update.description = payload.description;
          await admin.from("courses").update(update).eq("id", courseId);
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
          // approve = no-op
          break;
        }

        case "refund_recommendation": {
          // payload: { decision, amount_cents?, reason }
          const bookingId = action.target_id;
          if (!bookingId) throw new Error("missing booking_id");
          if (payload.decision === "approve_full" || payload.decision === "approve_partial") {
            const { data: b } = await admin
              .from("bookings")
              .select("student_id, online_total_cents")
              .eq("id", bookingId)
              .single();
            if (b) {
              await admin.from("refunds").insert({
                booking_id: bookingId,
                student_id: b.student_id,
                amount_cents:
                  payload.decision === "approve_full"
                    ? b.online_total_cents
                    : payload.amount_cents,
                reason: payload.reason ?? "AI-recommended refund",
                refund_type: payload.decision === "approve_full" ? "full" : "partial",
                issued_by: user.id,
              });
            }
          }
          break;
        }

        case "instructor_nudge": {
          // payload: { message }
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
          // payload: { classification, recommended_action, reply_text, internal_note, refund_amount_cents }
          const conversationId = action.target_id;
          if (!conversationId) throw new Error("missing conversation_id");
          const { data: conv } = await admin
            .from("conversations")
            .select("instructor_id, student_id, booking_id")
            .eq("id", conversationId)
            .single();
          if (!conv) throw new Error("conversation not found");

          // Always send the drafted reply to the student (as the platform/team).
          if (payload.reply_text) {
            await admin.from("messages").insert({
              conversation_id: conversationId,
              sender_id: conv.instructor_id,
              sender_role: "instructor",
              body: `${payload.reply_text}\n\n— the TacLink team`,
            });
          }

          // If a full refund was approved, issue it as in-app credit (no cash refunds).
          if (
            payload.recommended_action === "approve_full_refund" &&
            conv.booking_id &&
            (payload.refund_amount_cents ?? 0) > 0
          ) {
            const { data: b } = await admin
              .from("bookings")
              .select("student_id, online_total_cents, platform_fee_cents, deposit_amount_cents")
              .eq("id", conv.booking_id)
              .single();
            if (b) {
              // Insert refund — DB trigger auto-creates a matching student_credits row.
              await admin.from("refunds").insert({
                booking_id: conv.booking_id,
                student_id: b.student_id,
                amount_cents: payload.refund_amount_cents,
                reason: payload.internal_note ?? "Approved by owner — instructor no-show / dispute exception",
                refund_type: "full",
                issued_by: user.id,
                notes: `Dispute classification: ${payload.classification} (issued as in-app credit)`,
              });
              await admin.from("notifications").insert({
                recipient_id: b.student_id,
                type: "refund_issued",
                title: `In-app credit issued: $${(payload.refund_amount_cents / 100).toFixed(2)}`,
                body: `A $${(payload.refund_amount_cents / 100).toFixed(2)} credit has been added to your account. Apply it to your next booking.`,
                link: `/student/booking/${conv.booking_id}`,
              });
            }
          }

          // If app credit was offered (goodwill), issue a refund-style credit too.
          if (payload.recommended_action === "offer_app_credit" && conv.student_id && conv.booking_id) {
            const amount = payload.credit_amount_cents ?? 0;
            if (amount > 0) {
              const { data: b } = await admin
                .from("bookings")
                .select("student_id")
                .eq("id", conv.booking_id)
                .single();
              if (b) {
                await admin.from("refunds").insert({
                  booking_id: conv.booking_id,
                  student_id: b.student_id,
                  amount_cents: amount,
                  reason: payload.internal_note ?? `Goodwill credit (dispute: ${payload.classification})`,
                  refund_type: "goodwill",
                  issued_by: user.id,
                  notes: `Dispute classification: ${payload.classification} (goodwill in-app credit)`,
                });
              }
            } else {
              // Fallback: free-booking entitlement when no dollar amount was set.
              await admin.from("student_credits").insert({
                student_id: conv.student_id,
                credit_type: "free_booking",
                source: "dispute_resolution",
                note:
                  payload.internal_note ??
                  `Goodwill credit toward next course (dispute: ${payload.classification})`,
              });
            }
            await admin.from("notifications").insert({
              recipient_id: conv.student_id,
              type: "credit_issued",
              title: "Course credit added to your account",
              body:
                amount > 0
                  ? `A $${(amount / 100).toFixed(2)} in-app credit has been added toward your next course.`
                  : `A free-booking credit has been added toward your next course.`,
              link: `/student/bookings`,
            });
          }
          break;
        }

        default:
          throw new Error(`unknown action kind: ${action.kind}`);
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
    console.error("ai-execute error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
