// Automated $1 refund test workflow.
//
// POST /refund-test-run         { booking_id, amount_cents? }   -> starts a run
// GET  /refund-test-run?id=xxx                                   -> polls status
//
// What it does on POST:
//   1. Verifies caller is admin.
//   2. Snapshots the booking + most recent refund row + ledger.
//   3. Calls Helcim's POST /v2/payment/refund with the original transaction id.
//   4. Inserts a `refunds` row tagged `auto_issued=true, reason='launch_test'`.
//   5. Polls helcim_webhook_events / bookings / refunds for ~90s in the
//      background and writes the verdict back to refund_test_runs.
//
// Webhook signature validity is read straight from helcim_webhook_events
// (the pp-webhook function records signature_valid into payload).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const HELCIM_API_BASE = "https://api.helcim.com/v2";
const POLL_TOTAL_MS = 90_000;
const POLL_INTERVAL_MS = 3_000;

type Snapshot = {
  booking: Record<string, unknown> | null;
  latest_refund: Record<string, unknown> | null;
  ledger_entries: number;
};

async function snapshotBooking(sb: any, bookingId: string): Promise<Snapshot> {
  const [{ data: booking }, { data: refund }, { count }] = await Promise.all([
    sb.from("bookings")
      .select("id, status, escrow_status, deposit_status, helcim_transaction_id, course_price_cents, online_total_cents")
      .eq("id", bookingId).maybeSingle(),
    sb.from("refunds")
      .select("id, status, amount_cents, stripe_refund_status, external_reference, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("instructor_ledger")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", bookingId)
      .eq("entry_type", "reversed"),
  ]);
  return {
    booking: booking ?? null,
    latest_refund: refund ?? null,
    ledger_entries: count ?? 0,
  };
}

async function callHelcimRefund(
  apiToken: string,
  txnId: string,
  amountCents: number,
  idempotencyKey: string,
) {
  const res = await fetch(`${HELCIM_API_BASE}/payment/refund`, {
    method: "POST",
    headers: {
      "api-token": apiToken,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({
      originalTransactionId: txnId,
      amount: (amountCents / 100).toFixed(2),
      ipAddress: "0.0.0.0",
    }),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  return { ok: res.ok, status: res.status, body: parsed };
}

async function pollAndScore(
  sb: any,
  runId: string,
  bookingId: string,
  refundRowId: string,
  helcimRefundTxnId: string | null,
) {
  const deadline = Date.now() + POLL_TOTAL_MS;
  let webhookEvent: any = null;

  while (Date.now() < deadline) {
    // Look for a refund webhook event referencing this booking OR the new txn id
    const { data: ev } = await sb
      .from("helcim_webhook_events")
      .select("id, event_type, processing_status, payload, created_at, last_error")
      .or(`booking_id.eq.${bookingId},helcim_transaction_id.eq.${helcimRefundTxnId ?? "__none__"}`)
      .ilike("event_type", "%refund%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ev && ev.processing_status !== "received") {
      webhookEvent = ev;
      break;
    }
    if (ev) webhookEvent = ev; // keep most recent even if still received
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  const after = await snapshotBooking(sb, bookingId);

  // Compare against the refund row we created
  const { data: refundRow } = await sb
    .from("refunds")
    .select("id, status, stripe_refund_status, external_reference")
    .eq("id", refundRowId)
    .maybeSingle();

  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const webhookReceived = !!webhookEvent;
  const sigValid = webhookEvent
    ? (webhookEvent.processing_status !== "invalid_signature" &&
       webhookEvent.last_error !== "invalid signature")
    : null;
  const bookingUpdated = after.booking?.escrow_status === "refunded" ||
    after.booking?.deposit_status === "refunded";
  const refundRowUpdated = refundRow?.stripe_refund_status === "succeeded" ||
    !!refundRow?.external_reference;
  const ledgerReversed = after.ledger_entries > 0;

  checks.push({ name: "Helcim refund API call succeeded", pass: !!helcimRefundTxnId });
  checks.push({ name: "Webhook event received", pass: webhookReceived });
  checks.push({ name: "Webhook signature valid", pass: sigValid === true,
    detail: sigValid === null ? "no event yet" : (sigValid ? "" : "signature mismatch") });
  checks.push({ name: "Booking marked refunded", pass: bookingUpdated,
    detail: `escrow_status=${after.booking?.escrow_status ?? "?"}` });
  checks.push({ name: "Refunds row updated by webhook", pass: refundRowUpdated });
  checks.push({ name: "Instructor ledger reversed", pass: ledgerReversed });

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  let status: "passed" | "partial" | "failed";
  if (passed === total) status = "passed";
  else if (passed >= 3) status = "partial";
  else status = "failed";

  await sb.from("refund_test_runs").update({
    status,
    after_snapshot: after,
    webhook_event_id: webhookEvent?.id ?? null,
    webhook_received: webhookReceived,
    webhook_signature_valid: sigValid,
    booking_updated: bookingUpdated,
    refund_row_updated: refundRowUpdated,
    ledger_reversed: ledgerReversed,
    checks,
    completed_at: new Date().toISOString(),
  }).eq("id", runId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );

  // Authn: get caller, require admin
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return json({ error: "unauthorized" }, 401);
  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) return json({ error: "forbidden — admin only" }, 403);

  // Use service-role client for writes (bypasses RLS for ledger inserts etc.)
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (req.method === "GET") {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ error: "missing id" }, 400);
    const { data, error } = await admin.from("refund_test_runs").select("*").eq("id", id).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    return json({ run: data });
  }

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: { booking_id?: string; amount_cents?: number } = {};
  try { body = await req.json(); } catch { /* allow empty */ }

  if (!body.booking_id) return json({ error: "booking_id required" }, 400);
  const amountCents = Math.max(1, Math.min(body.amount_cents ?? 100, 1000));

  // Load booking
  const { data: booking, error: bookErr } = await admin
    .from("bookings")
    .select("id, student_id, helcim_transaction_id, payment_provider, online_total_cents, course_price_cents")
    .eq("id", body.booking_id)
    .maybeSingle();
  if (bookErr) return json({ error: bookErr.message }, 500);
  if (!booking) return json({ error: "booking not found" }, 404);
  if (!booking.helcim_transaction_id) {
    return json({ error: "booking has no helcim_transaction_id (was it paid via Helcim?)" }, 400);
  }

  const apiToken = Deno.env.get("HELCIM_API_TOKEN");
  if (!apiToken) return json({ error: "HELCIM_API_TOKEN not configured" }, 500);

  const before = await snapshotBooking(admin, booking.id);

  // Create the run row up-front so the UI can poll immediately
  const { data: runIns, error: runErr } = await admin
    .from("refund_test_runs")
    .insert({
      started_by: user.id,
      booking_id: booking.id,
      helcim_transaction_id: booking.helcim_transaction_id,
      amount_cents: amountCents,
      environment: (Deno.env.get("HELCIM_ENV") ?? "live").toLowerCase(),
      status: "running",
      before_snapshot: before,
    })
    .select("id")
    .single();
  if (runErr) return json({ error: runErr.message }, 500);
  const runId = runIns.id as string;

  // Insert pending refund row so webhook can match it
  const { data: refundRow, error: refundInsErr } = await admin
    .from("refunds")
    .insert({
      booking_id: booking.id,
      student_id: booking.student_id,
      issued_by: user.id,
      amount_cents: amountCents,
      student_cash_refund_cents: amountCents,
      refund_type: "partial",
      refund_method: "stripe_cash", // generic "online refund" — works for Helcim too
      reason: "Automated $1 launch-readiness refund test",
      status: "issued",
      auto_issued: true,
    })
    .select("id")
    .single();
  if (refundInsErr) {
    await admin.from("refund_test_runs").update({
      status: "error",
      error_message: `refunds insert failed: ${refundInsErr.message}`,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);
    return json({ error: refundInsErr.message, run_id: runId }, 500);
  }

  // Call Helcim
  const helcimResp = await callHelcimRefund(
    apiToken,
    booking.helcim_transaction_id,
    amountCents,
    `refund-test:${runId}`,
  );

  const helcimTxnId = (helcimResp.body as any)?.transactionId ??
    (helcimResp.body as any)?.data?.transactionId ?? null;

  await admin.from("refund_test_runs").update({
    refund_id: refundRow.id,
    helcim_refund_response: helcimResp.body,
    helcim_refund_txn_id: helcimTxnId ? String(helcimTxnId) : null,
  }).eq("id", runId);

  if (!helcimResp.ok) {
    await admin.from("refunds").update({
      status: "failed",
      stripe_refund_status: "helcim_api_error",
      notes: `Helcim API ${helcimResp.status}: ${JSON.stringify(helcimResp.body).slice(0, 500)}`,
    }).eq("id", refundRow.id);

    await admin.from("refund_test_runs").update({
      status: "error",
      error_message: `Helcim API returned ${helcimResp.status}`,
      after_snapshot: await snapshotBooking(admin, booking.id),
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    return json({ run_id: runId, error: "helcim refund failed", helcim: helcimResp });
  }

  // Background poll — don't block the request
  // @ts-ignore - EdgeRuntime exists in Supabase Edge runtime
  EdgeRuntime.waitUntil(pollAndScore(admin, runId, booking.id, refundRow.id, helcimTxnId ? String(helcimTxnId) : null));

  return json({ run_id: runId, helcim_refund_txn_id: helcimTxnId });
});
