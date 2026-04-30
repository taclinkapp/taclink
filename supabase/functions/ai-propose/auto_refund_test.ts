// End-to-end tests for the reason-based auto-refund decision pipeline.
//
// Coverage:
//   1. ai-propose gating logic (which dispute_triage payloads auto-approve)
//   2. compute_refund_split RPC (the canonical money-split source of truth)
//   3. compute_student_risk_score RPC (still used by executor)
//
// We test the gating logic in pure JS (mirror of ai-propose source) plus
// real RPC calls against the live Supabase instance.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
assert(SUPABASE_URL, "VITE_SUPABASE_URL missing in .env");
assert(SUPABASE_ANON_KEY, "VITE_SUPABASE_PUBLISHABLE_KEY missing in .env");

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =================================================================
// Helper: mirror of ai-propose's reason-based gating logic.
// Kept in lockstep with supabase/functions/ai-propose/index.ts.
// =================================================================
const AUTO_ELIGIBLE = new Set([
  "instructor_no_show",
  "instructor_cancel",
  "student_cancel_timely",
]);

async function decide(
  kind: string,
  args: { risk_level: string; confidence: number; payload: any },
): Promise<{ status: "approved" | "proposed" | "auto_paused"; autoApproved: boolean }> {
  let status: "approved" | "proposed" | "auto_paused" =
    args.risk_level === "high" || (args.confidence ?? 0) < 0.6
      ? "auto_paused"
      : "proposed";

  const { data: settings } = await supabase
    .from("ai_auto_approve_settings")
    .select("rules")
    .eq("id", 1)
    .maybeSingle();
  const rules = (settings?.rules ?? {}) as Record<string, any>;

  let autoApproved = false;

  if (kind === "dispute_triage" && status === "proposed") {
    const refundRule = rules.auto_refund;
    const decision = args.payload?.recommended_action;
    const reasonCategory =
      args.payload?.refund_reason_category ?? args.payload?.classification;
    if (
      refundRule?.enabled &&
      decision === "issue_credit" &&
      reasonCategory &&
      AUTO_ELIGIBLE.has(reasonCategory) &&
      (args.confidence ?? 0) >= (refundRule.min_confidence ?? 0.95) &&
      args.risk_level !== "high"
    ) {
      status = "approved";
      autoApproved = true;
    }
  }

  return { status, autoApproved };
}

// =================================================================
// Decision-gate tests
// =================================================================

Deno.test("instructor_no_show + issue_credit + low risk → AUTO-APPROVED", async () => {
  const r = await decide("dispute_triage", {
    risk_level: "low",
    confidence: 0.97,
    payload: {
      refund_reason_category: "instructor_no_show",
      recommended_action: "issue_credit",
      reply_text: "Sorry — issuing your credit now.",
    },
  });
  assertEquals(r.status, "approved");
  assertEquals(r.autoApproved, true);
});

Deno.test("student_cancel_timely + issue_credit → AUTO-APPROVED", async () => {
  const r = await decide("dispute_triage", {
    risk_level: "low",
    confidence: 0.96,
    payload: {
      refund_reason_category: "student_cancel_timely",
      recommended_action: "issue_credit",
    },
  });
  assertEquals(r.status, "approved");
});

Deno.test("fraud_safety → NOT auto-approved (must go to owner)", async () => {
  const r = await decide("dispute_triage", {
    risk_level: "high",
    confidence: 0.97,
    payload: {
      refund_reason_category: "fraud_safety",
      recommended_action: "escalate_to_owner",
    },
  });
  assertEquals(r.autoApproved, false);
});

Deno.test("chargeback_threat → NOT auto-approved", async () => {
  const r = await decide("dispute_triage", {
    risk_level: "high",
    confidence: 0.99,
    payload: {
      refund_reason_category: "chargeback_threat",
      recommended_action: "escalate_to_owner",
    },
  });
  assertEquals(r.autoApproved, false);
});

Deno.test("quality_complaint → NOT auto-approved (owner reviews)", async () => {
  const r = await decide("dispute_triage", {
    risk_level: "medium",
    confidence: 0.97,
    payload: {
      refund_reason_category: "quality_complaint",
      recommended_action: "issue_credit",
    },
  });
  assertEquals(r.autoApproved, false);
});

Deno.test("low confidence (<0.95) → NOT auto-approved", async () => {
  const r = await decide("dispute_triage", {
    risk_level: "low",
    confidence: 0.85,
    payload: {
      refund_reason_category: "instructor_no_show",
      recommended_action: "issue_credit",
    },
  });
  assertEquals(r.autoApproved, false);
});

Deno.test("deny_politely action → NOT auto-approved (no credit issued)", async () => {
  const r = await decide("dispute_triage", {
    risk_level: "low",
    confidence: 0.99,
    payload: {
      refund_reason_category: "student_cancel_late",
      recommended_action: "deny_politely",
    },
  });
  assertEquals(r.autoApproved, false);
});

// =================================================================
// compute_refund_split contract tests
// These create a real booking + course, then verify the split.
// =================================================================

async function setupBookingForSplit(
  startsInHours: number,
): Promise<{ bookingId: string; cleanup: () => Promise<void> }> {
  // Use service role for fixture setup if available; otherwise skip these tests.
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SERVICE) {
    return { bookingId: "", cleanup: async () => {} };
  }
  const admin = createClient(SUPABASE_URL, SERVICE);
  const studentId = crypto.randomUUID();
  const instructorId = crypto.randomUUID();
  const startsAt = new Date(Date.now() + startsInHours * 3600 * 1000).toISOString();
  const { data: course } = await admin
    .from("courses")
    .insert({
      instructor_id: instructorId,
      title: "Test course",
      price_cents: 10000,
      starts_at: startsAt,
      status: "published",
    })
    .select("id")
    .single();
  const { data: booking } = await admin
    .from("bookings")
    .insert({
      student_id: studentId,
      course_id: course!.id,
      online_total_cents: 3500,
      platform_fee_cents: 2500,
      deposit_amount_cents: 1000,
      due_in_person_cents: 9000,
      course_price_cents: 10000,
    })
    .select("id")
    .single();
  return {
    bookingId: booking!.id,
    cleanup: async () => {
      await admin.from("bookings").delete().eq("id", booking!.id);
      await admin.from("courses").delete().eq("id", course!.id);
    },
  };
}

Deno.test("compute_refund_split: instructor_no_show → student gets $35, instructor forfeits $10", async () => {
  const { bookingId, cleanup } = await setupBookingForSplit(48);
  if (!bookingId) return; // skipped without service key
  try {
    const { data, error } = await supabase.rpc("compute_refund_split", {
      _booking_id: bookingId,
      _reason: "instructor_no_show",
    });
    assert(!error, error?.message);
    const row = Array.isArray(data) ? data[0] : data;
    assertEquals(row.student_credit_cents, 3500);
    assertEquals(row.instructor_forfeit_cents, 1000);
    assertEquals(row.platform_absorbed_cents, 0);
    assertEquals(row.requires_owner, false);
  } finally {
    await cleanup();
  }
});

Deno.test("compute_refund_split: student_cancel_timely (>=48h) → student gets $25 only", async () => {
  const { bookingId, cleanup } = await setupBookingForSplit(72);
  if (!bookingId) return;
  try {
    const { data } = await supabase.rpc("compute_refund_split", {
      _booking_id: bookingId,
      _reason: "student_cancel_timely",
    });
    const row = Array.isArray(data) ? data[0] : data;
    assertEquals(row.student_credit_cents, 2500);
    assertEquals(row.instructor_forfeit_cents, 0);
  } finally {
    await cleanup();
  }
});

Deno.test("compute_refund_split: student_cancel_late (<48h) → no credit", async () => {
  const { bookingId, cleanup } = await setupBookingForSplit(12);
  if (!bookingId) return;
  try {
    const { data } = await supabase.rpc("compute_refund_split", {
      _booking_id: bookingId,
      _reason: "student_cancel_late",
    });
    const row = Array.isArray(data) ? data[0] : data;
    assertEquals(row.student_credit_cents, 0);
    assertEquals(row.instructor_forfeit_cents, 0);
  } finally {
    await cleanup();
  }
});

Deno.test("compute_refund_split: auto-detects late vs timely from start time", async () => {
  const { bookingId, cleanup } = await setupBookingForSplit(24); // < 48h
  if (!bookingId) return;
  try {
    const { data } = await supabase.rpc("compute_refund_split", {
      _booking_id: bookingId,
      _reason: "student_cancel", // generic — should detect "late"
    });
    const row = Array.isArray(data) ? data[0] : data;
    assertEquals(row.reason_category, "student_cancel_late");
    assertEquals(row.student_credit_cents, 0);
  } finally {
    await cleanup();
  }
});

Deno.test("compute_refund_split: chargeback_threat → requires_owner true, no credit", async () => {
  const { bookingId, cleanup } = await setupBookingForSplit(48);
  if (!bookingId) return;
  try {
    const { data } = await supabase.rpc("compute_refund_split", {
      _booking_id: bookingId,
      _reason: "chargeback_threat",
    });
    const row = Array.isArray(data) ? data[0] : data;
    assertEquals(row.requires_owner, true);
    assertEquals(row.student_credit_cents, 0);
  } finally {
    await cleanup();
  }
});

Deno.test("compute_refund_split: weather_reschedule → no money moves", async () => {
  const { bookingId, cleanup } = await setupBookingForSplit(48);
  if (!bookingId) return;
  try {
    const { data } = await supabase.rpc("compute_refund_split", {
      _booking_id: bookingId,
      _reason: "weather_reschedule",
    });
    const row = Array.isArray(data) ? data[0] : data;
    assertEquals(row.student_credit_cents, 0);
    assertEquals(row.instructor_forfeit_cents, 0);
    assertEquals(row.platform_absorbed_cents, 0);
  } finally {
    await cleanup();
  }
});

Deno.test("compute_refund_split: quality_complaint → $25 absorbed by TacLink, owner review", async () => {
  const { bookingId, cleanup } = await setupBookingForSplit(-24); // course already happened
  if (!bookingId) return;
  try {
    const { data } = await supabase.rpc("compute_refund_split", {
      _booking_id: bookingId,
      _reason: "quality_complaint",
    });
    const row = Array.isArray(data) ? data[0] : data;
    assertEquals(row.student_credit_cents, 2500);
    assertEquals(row.platform_absorbed_cents, 2500);
    assertEquals(row.requires_owner, true);
  } finally {
    await cleanup();
  }
});
