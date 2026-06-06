// ai-scheduled-scan — runs every hour via pg_cron.
// Scans for: dormant instructors, unanswered student messages > 24h,
// support tickets that mention refund/cancel/charge keywords.
// For each finding, calls ai-propose so the owner sees a draft action.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Cron-only entry point
  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Fetch the internal token used to authenticate to ai-propose.
  const { data: tokRow } = await admin
    .from("_ai_internal_tokens")
    .select("token")
    .eq("name", "ai_propose")
    .maybeSingle();
  const internalToken = tokRow?.token ?? "";

  const propose = async (payload: Record<string, unknown>) => {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/ai-propose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ai-internal-token": internalToken,
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error("propose call failed", e);
    }
  };

  const summary: Record<string, number> = {
    nudges_queued: 0,
    refund_drafts_queued: 0,
    stale_message_drafts_queued: 0,
  };

  // ---- 1. Stale conversations: student message > 24h with no instructor reply
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: convs } = await admin
      .from("conversations")
      .select("id, instructor_id, student_id, course_title, instructor_name, student_name, last_message, last_message_at")
      .lt("last_message_at", since)
      .limit(50);

    for (const c of convs ?? []) {
      // last message must have been from the student
      const { data: lastMsg } = await admin
        .from("messages")
        .select("sender_role, body, created_at")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!lastMsg || lastMsg.sender_role !== "student") continue;

      // skip if there's already a draft for this conv
      const { count } = await admin
        .from("ai_actions")
        .select("id", { count: "exact", head: true })
        .eq("kind", "message_reply")
        .eq("target_id", c.id)
        .in("status", ["proposed", "auto_paused", "approved"]);
      if ((count ?? 0) > 0) continue;

      await propose({
        kind: "message_reply",
        target_type: "conversation",
        target_id: c.id,
        context: {
          conversation_id: c.id,
          course_title: c.course_title,
          student_name: c.student_name,
          instructor_name: c.instructor_name,
          latest_message: lastMsg.body,
          stale_hours: 24,
        },
      });
      summary.stale_message_drafts_queued++;
    }
  } catch (e) {
    console.error("stale conv scan failed", e);
  }

  // ---- 2. Dormant instructors: have role 'instructor', no published course in 30d
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: instructorRoles } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "instructor")
      .limit(100);

    for (const r of instructorRoles ?? []) {
      const { count: recentCourses } = await admin
        .from("courses")
        .select("id", { count: "exact", head: true })
        .eq("instructor_id", r.user_id)
        .gte("updated_at", cutoff);
      if ((recentCourses ?? 0) > 0) continue;

      const { count: existing } = await admin
        .from("ai_actions")
        .select("id", { count: "exact", head: true })
        .eq("kind", "instructor_nudge")
        .eq("target_id", r.user_id)
        .in("status", ["proposed", "auto_paused", "approved"]);
      if ((existing ?? 0) > 0) continue;

      const { data: prof } = await admin
        .from("profiles")
        .select("display_name, subscription_status")
        .eq("id", r.user_id)
        .maybeSingle();

      await propose({
        kind: "instructor_nudge",
        target_type: "instructor",
        target_id: r.user_id,
        context: {
          instructor_id: r.user_id,
          display_name: prof?.display_name,
          subscription_status: prof?.subscription_status,
          situation: "No course updates in the last 30 days",
        },
      });
      summary.nudges_queued++;
    }
  } catch (e) {
    console.error("dormant instructor scan failed", e);
  }

  // ---- 3. Refund-keyword detection in support tickets
  try {
    const REFUND_KW = /\b(refund|cancel|charge( ?back)?|money back|reimburse)\b/i;
    const { data: tickets } = await admin
      .from("issue_reports")
      .select("id, description, reporter_email, reporter_role, page_url, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50);

    for (const t of tickets ?? []) {
      if (!REFUND_KW.test(t.description ?? "")) continue;

      const { count } = await admin
        .from("ai_actions")
        .select("id", { count: "exact", head: true })
        .eq("kind", "refund_recommendation")
        .eq("target_id", t.id)
        .in("status", ["proposed", "auto_paused", "approved"]);
      if ((count ?? 0) > 0) continue;

      await propose({
        kind: "refund_recommendation",
        target_type: "support_ticket",
        target_id: t.id,
        context: {
          ticket_id: t.id,
          description: t.description,
          reporter_email: t.reporter_email,
          reporter_role: t.reporter_role,
          page_url: t.page_url,
          note: "Auto-flagged from support ticket containing refund-related keywords. Booking-level context not auto-attached; owner should verify amount.",
        },
      });
      summary.refund_drafts_queued++;
    }
  } catch (e) {
    console.error("refund keyword scan failed", e);
  }

  return new Response(JSON.stringify({ ok: true, summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
