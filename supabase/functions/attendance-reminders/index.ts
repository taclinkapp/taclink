// attendance-reminders — runs hourly. Two jobs:
// 1) For unscanned, non-claim bookings whose course ended 2h/12h/24h ago,
//    send the student an "verify attendance" nudge (escalating tone).
// 2) For pending attendance_claims past auto_approve_at, flip to auto_approved
//    (the trigger handles marking attended + setting release window).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const REMINDER_STAGES = [
  { hours: 2, count: 0, tone: "Quick check — were you at your course?" },
  { hours: 12, count: 1, tone: "Reminder: please confirm your course attendance" },
  { hours: 24, count: 2, tone: "Last call — confirm attendance to avoid issues" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const summary: Record<string, number> = {
    auto_approved: 0,
    reminders_sent: 0,
  };

  // 1. Auto-approve overdue claims.
  try {
    const { data: due } = await admin.rpc("list_due_attendance_claims");
    for (const row of (due ?? []) as Array<{ claim_id: string; booking_id: string; student_id: string }>) {
      await admin
        .from("attendance_claims")
        .update({
          status: "auto_approved",
          ai_decision: "auto_approved_no_response",
          ai_reasoning: "Student did not respond within the 48-hour window.",
        })
        .eq("id", row.claim_id);
      await admin.from("notifications").insert({
        recipient_id: row.student_id,
        type: "attendance_auto_approved",
        title: "Attendance auto-approved",
        body: "You didn't respond within 48 hours, so the instructor's claim was approved.",
        link: `/student/booking/${row.booking_id}`,
      });
      summary.auto_approved++;
    }
  } catch (e) {
    console.error("auto-approve loop failed", e);
  }

  // 2. Reminders for unscanned students with no claim.
  try {
    const nowMs = Date.now();
    const { data: bookings } = await admin
      .from("bookings")
      .select(
        "id, status, student_id, course_id, courses!inner(starts_at, ends_at, title)",
      )
      .neq("status", "attended")
      .neq("status", "cancelled")
      .neq("status", "no_show")
      .limit(500);

    for (const b of (bookings ?? []) as any[]) {
      const ends = b.courses?.ends_at ?? b.courses?.starts_at;
      if (!ends) continue;
      const endedHoursAgo = (nowMs - new Date(ends).getTime()) / 3_600_000;
      if (endedHoursAgo < 2 || endedHoursAgo > 26) continue;

      // Skip if a claim exists.
      const { count: claimCount } = await admin
        .from("attendance_claims")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", b.id);
      if ((claimCount ?? 0) > 0) continue;

      // Pick the appropriate stage.
      const stage = REMINDER_STAGES.slice()
        .reverse()
        .find((s) => endedHoursAgo >= s.hours);
      if (!stage) continue;

      // Dedupe by checking notifications.
      const { count: already } = await admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", b.student_id)
        .eq("type", `attendance_reminder_${stage.count}`)
        .gte("created_at", new Date(nowMs - 36 * 3600_000).toISOString());
      if ((already ?? 0) > 0) continue;

      await admin.from("notifications").insert({
        recipient_id: b.student_id,
        type: `attendance_reminder_${stage.count}`,
        title: stage.tone,
        body: `If you attended "${b.courses?.title ?? "your course"}", ask your instructor to confirm so funds can release on time.`,
        link: `/student/booking/${b.id}`,
      });
      summary.reminders_sent++;
    }
  } catch (e) {
    console.error("reminders loop failed", e);
  }

  return new Response(JSON.stringify({ ok: true, summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
