// Helcim webhook handler with idempotency + safe retries.
//
// Helcim sends webhooks for transaction.success, transaction.refunded,
// subscription.* events. Signature verification uses HMAC-SHA256 over the
// raw body with HELCIM_WEBHOOK_VERIFIER_TOKEN, compared to the
// `webhook-signature` header (Helcim's standard).
//
// STATUS: scaffolded, dormant. The signature verification + idempotency
// shell is production-ready; the per-event handlers throw until the
// HelcimProvider adapter is finished in Phase 2. This file exists so the
// webhook URL is stable and can be registered in the Helcim dashboard
// before the merchant account is fully approved.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-signature, webhook-id, webhook-timestamp",
};

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

type HelcimEnv = "sandbox" | "live";

async function verifyHelcimSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookId: string | null,
  webhookTimestamp: string | null,
): Promise<boolean> {
  const verifierToken = Deno.env.get("HELCIM_WEBHOOK_VERIFIER_TOKEN");
  if (!verifierToken) {
    console.error("HELCIM_WEBHOOK_VERIFIER_TOKEN not configured");
    return false;
  }
  if (!signatureHeader || !webhookId || !webhookTimestamp) {
    console.error("Missing webhook signature headers", {
      hasSig: !!signatureHeader, hasId: !!webhookId, hasTs: !!webhookTimestamp,
    });
    return false;
  }

  // Helcim uses Svix-style signatures: HMAC-SHA256 of `${id}.${timestamp}.${body}`
  // signed with the verifier token (which may be base64-prefixed `whsec_...`).
  // Header value: space-separated `v1,<base64sig>` entries.
  let keyBytes: Uint8Array;
  if (verifierToken.startsWith("whsec_")) {
    const b64 = verifierToken.slice(6);
    const bin = atob(b64);
    keyBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) keyBytes[i] = bin.charCodeAt(i);
  } else {
    keyBytes = new TextEncoder().encode(verifierToken);
  }

  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const toSign = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(toSign));
  const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(signed)));

  // Compare against any v1 entry in the header
  const entries = signatureHeader.split(" ");
  for (const entry of entries) {
    const [version, sig] = entry.split(",");
    if (version === "v1" && sig === expectedB64) return true;
  }
  console.error("Helcim webhook signature mismatch", { expected: expectedB64, got: signatureHeader });
  return false;
}

/**
 * Try to record an event id. Returns true if first time seen, false if
 * already processed (safe to skip).
 */
async function claimEvent(
  eventId: string,
  eventType: string,
  env: HelcimEnv,
  payload: unknown,
): Promise<boolean> {
  const { error } = await getSupabase()
    .from("helcim_webhook_events")
    .insert({
      event_id: eventId,
      event_type: eventType,
      environment: env,
      payload: payload as any,
      processing_status: "processing",
      attempt_count: 1,
      last_attempted_at: new Date().toISOString(),
    });
  if (!error) return true;
  if ((error as any).code === "23505") return false;
  console.error("Failed to claim Helcim event", eventId, error);
  throw error;
}

async function markEventStatus(
  eventId: string,
  status: "succeeded" | "failed",
  patch: { last_error?: string | null; helcim_transaction_id?: string | null; booking_id?: string | null } = {},
) {
  await getSupabase()
    .from("helcim_webhook_events")
    .update({
      processing_status: status,
      last_error: patch.last_error ?? null,
      helcim_transaction_id: patch.helcim_transaction_id ?? null,
      booking_id: patch.booking_id ?? null,
      last_attempted_at: new Date().toISOString(),
    })
    .eq("event_id", eventId);
}

// Helcim webhook payloads vary by event but consistently expose:
//   data.id / data.transactionId — Helcim transaction id
//   data.amount — decimal dollars
//   data.currency — ISO currency
function pickTransactionId(d: any): string | null {
  return d?.transactionId ?? d?.id ?? d?.transaction?.id ?? null;
}
function pickBookingId(d: any): string | null {
  return d?.invoiceNumber ?? d?.invoice?.invoiceNumber ?? d?.customerCode ?? null;
}

async function handleTransactionSuccess(payload: any, _env: HelcimEnv) {
  const sb = getSupabase();
  const data = payload ?? {};
  const txnId = pickTransactionId(data);
  const bookingId = pickBookingId(data);

  if (!txnId) throw new Error("transaction.success missing transactionId");

  // Find booking: prefer legacy invoiceNumber/customerCode if present,
  // otherwise fall back to helcim_checkout_token if Helcim includes it.
  let booking: any = null;
  if (bookingId) {
    const { data: row } = await sb
      .from("bookings")
      .select("id, course_id, course_price_cents, instructor_payout_cents, escrow_status, deposit_status")
      .eq("id", bookingId)
      .maybeSingle();
    booking = row;
  }
  if (!booking && data?.checkoutToken) {
    const { data: row } = await sb
      .from("bookings")
      .select("id, course_id, course_price_cents, instructor_payout_cents, escrow_status, deposit_status")
      .eq("helcim_checkout_token", data.checkoutToken)
      .maybeSingle();
    booking = row;
  }
  if (!booking) {
    throw new Error(`No booking match for Helcim transaction ${txnId} (bookingId=${bookingId ?? "?"})`);
  }

  // Only flip if not already held/released — webhooks may retry.
  if (booking.escrow_status !== "held" && booking.escrow_status !== "released") {
    const { error: updErr } = await sb
      .from("bookings")
      .update({
        helcim_transaction_id: String(txnId),
        deposit_status: "held_in_escrow",
        escrow_status: "held",
        escrow_held_at: new Date().toISOString(),
        payment_provider: "helcim",
      })
      .eq("id", booking.id);
    if (updErr) throw updErr;
  } else {
    // Still record the txn id if missing.
    await sb.from("bookings").update({ helcim_transaction_id: String(txnId) })
      .eq("id", booking.id).is("helcim_transaction_id", null);
  }

  // Record instructor's owed balance (Helcim has no marketplace split).
  // Available 24h after course end (release-escrow-deposits batch picks it up).
  const { data: course } = await sb
    .from("courses")
    .select("instructor_id, ends_at, starts_at")
    .eq("id", booking.course_id)
    .maybeSingle();

  const owedCents = booking.instructor_payout_cents > 0
    ? booking.instructor_payout_cents
    : booking.course_price_cents;

  if (course?.instructor_id && owedCents > 0) {
    const endsAt = course.ends_at ?? course.starts_at;
    const availableAt = endsAt
      ? new Date(new Date(endsAt).getTime() + 24 * 3600 * 1000).toISOString()
      : null;

    // Insert the 'owed' ledger entry. The DB now enforces a unique partial
    // index on (booking_id) WHERE entry_type='owed', so concurrent webhook +
    // confirm-helcim-payment calls cannot double-credit; the loser gets a
    // 23505 which we swallow as a benign no-op.
    const { error: insErr } = await sb.from("instructor_ledger").insert({
      instructor_id: course.instructor_id,
      booking_id: booking.id,
      provider: "helcim",
      entry_type: "owed",
      amount_cents: owedCents,
      currency: (data.currency ?? "usd").toLowerCase(),
      available_at: availableAt,
      notes: `Helcim transaction ${txnId}`,
    });
    if (insErr && insErr.code !== "23505") {
      throw insErr;
    }
  }


  await markEventStatus(String(payload?.eventId ?? ""), "succeeded", {
    helcim_transaction_id: String(txnId),
    booking_id: booking.id,
  }).catch(() => { /* eventId stamping handled by outer flow */ });
}

async function handleTransactionRefunded(payload: any, _env: HelcimEnv) {
  const sb = getSupabase();
  const data = payload ?? {};
  const txnId = pickTransactionId(data);
  const originalTxnId = data?.originalTransactionId ?? data?.referenceTransactionId ?? null;
  const refundAmountCents = Math.round(Number(data?.amount ?? 0) * 100);

  if (!txnId && !originalTxnId) {
    throw new Error("transaction.refunded missing transaction reference");
  }

  // Find the booking by either the refund txn id (if we recorded it) or the
  // original charge id we stored at success time.
  const lookupId = originalTxnId ?? txnId;
  const { data: booking } = await sb
    .from("bookings")
    .select("id, course_id, escrow_status")
    .eq("helcim_transaction_id", String(lookupId))
    .maybeSingle();

  if (!booking) {
    throw new Error(`No booking match for Helcim refund (txn=${txnId}, orig=${originalTxnId})`);
  }

  // Mark any matching pending refund row as issued, or insert a record if
  // the refund originated outside our app (manual Helcim dashboard refund).
  const { data: pending } = await sb
    .from("refunds")
    .select("id, amount_cents, status")
    .eq("booking_id", booking.id)
    .in("status", ["issued", "failed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pending) {
    await sb.from("refunds").update({
      status: "issued",
      external_reference: String(txnId),
      stripe_refund_status: "succeeded",
    }).eq("id", pending.id);
  }

  // Reverse the instructor's owed ledger entry (full or partial).
  const { data: owedRow } = await sb
    .from("instructor_ledger")
    .select("id, instructor_id, amount_cents, currency")
    .eq("booking_id", booking.id)
    .eq("entry_type", "owed")
    .maybeSingle();

  if (owedRow && refundAmountCents > 0) {
    const reverseCents = Math.min(refundAmountCents, owedRow.amount_cents);
    await sb.from("instructor_ledger").insert({
      instructor_id: owedRow.instructor_id,
      booking_id: booking.id,
      provider: "helcim",
      entry_type: "reversed",
      amount_cents: reverseCents,
      currency: owedRow.currency,
      notes: `Reversal for Helcim refund ${txnId}`,
    });
  }

  // Update booking escrow state.
  if (booking.escrow_status === "held") {
    await sb.from("bookings").update({
      escrow_status: "refunded",
      deposit_status: "refunded",
    }).eq("id", booking.id);
  }
}

async function handleSubscriptionEvent(payload: any, _env: HelcimEnv) {
  const sb = getSupabase();
  const data = payload ?? {};
  const subId = data?.subscriptionId ?? data?.id;
  const customerCode = data?.customerCode;
  const status = (data?.status ?? "active").toLowerCase();

  if (!subId) throw new Error("subscription event missing subscriptionId");

  // customerCode in our checkout = userId (set in create-helcim-checkout for
  // future subscription support). For now, only update if a row already
  // exists keyed by helcim_subscription_id.
  const periodEnd = data?.currentPeriodEnd ?? data?.nextBillingDate ?? null;
  const cancelAtEnd = !!(data?.cancelAtPeriodEnd ?? data?.cancel_at_period_end);

  const { data: existing } = await sb
    .from("subscriptions")
    .select("id, user_id")
    .eq("helcim_subscription_id", String(subId))
    .maybeSingle();

  if (existing) {
    await sb.from("subscriptions").update({
      status,
      current_period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
      cancel_at_period_end: cancelAtEnd,
    }).eq("id", existing.id);
    return;
  }

  // No existing row — only insert if we can resolve user_id from customerCode
  // (which create-helcim-subscription-checkout will set to the user uuid).
  if (customerCode && /^[0-9a-f-]{36}$/i.test(String(customerCode))) {
    await sb.from("subscriptions").insert({
      user_id: String(customerCode),
      helcim_subscription_id: String(subId),
      stripe_subscription_id: `helcim_${subId}`,
      stripe_customer_id: `helcim_${customerCode}`,
      product_id: data?.productId ?? "helcim_unknown",
      price_id: data?.priceId ?? "helcim_unknown",
      status,
      current_period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
      cancel_at_period_end: cancelAtEnd,
      payment_provider: "helcim",
    });
  } else {
    console.warn("subscription event with no resolvable user_id", subId);
  }
}

async function dispatch(eventType: string, data: any, env: HelcimEnv) {
  switch (eventType) {
    case "transaction.success":
    case "cardTransaction.success":
      return handleTransactionSuccess(data, env);
    case "transaction.refunded":
    case "cardTransaction.refunded":
      return handleTransactionRefunded(data, env);
    case "subscription.created":
    case "subscription.updated":
    case "subscription.cancelled":
    case "subscription.payment_succeeded":
    case "subscription.payment_failed":
      return handleSubscriptionEvent(data, env);
    default:
      console.log("Unhandled Helcim event:", eventType);
  }
}

/**
 * Admin-triggered retry path. Re-runs the dispatcher against the stored
 * payload of an existing event row, then updates processing_status.
 * Auth: requires a verified admin user. We do NOT verify the Helcim
 * signature here because the payload was already verified at original
 * intake time.
 */
async function handleAdminRetry(req: Request, body: { event_id: string; environment: HelcimEnv }) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await sb.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: row, error: rowErr } = await sb
    .from("helcim_webhook_events")
    .select("event_id, event_type, payload, attempt_count")
    .eq("event_id", body.event_id)
    .maybeSingle();
  if (rowErr || !row) {
    return new Response(JSON.stringify({ error: "Event not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload = row.payload as { data?: any };
  try {
    await dispatch(row.event_type as string, payload?.data, body.environment);
    await markEventStatus(row.event_id as string, "succeeded");
    return new Response(JSON.stringify({ retried: true, status: "succeeded" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await markEventStatus(row.event_id as string, "failed", { last_error: String((e as Error)?.message ?? e) });
    return new Response(JSON.stringify({ retried: true, status: "failed", error: String((e as Error)?.message ?? e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Admin retry path uses an authenticated JSON body with __retry: true.
  // We branch BEFORE signature verification because there's no Helcim
  // signature on a manually-replayed event.
  const peek = await req.clone().text();
  let asJson: any = null;
  try { asJson = JSON.parse(peek); } catch { /* not JSON, fall through */ }
  if (asJson && asJson.__retry === true && typeof asJson.event_id === "string") {
    const env: HelcimEnv = asJson.environment === "live" ? "live" : "sandbox";
    return await handleAdminRetry(req, { event_id: asJson.event_id, environment: env });
  }

  // Helcim doesn't allow query strings in webhook URLs, so default to "live"
  // when no env param is present. Sandbox can still be forced via ?env=sandbox.
  const rawEnv = new URL(req.url).searchParams.get("env") ?? "live";
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("Helcim webhook: invalid env query param:", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const env: HelcimEnv = rawEnv;

  const rawBody = peek;
  const signature = req.headers.get("webhook-signature");
  const webhookId = req.headers.get("webhook-id");
  const webhookTimestamp = req.headers.get("webhook-timestamp");

  const valid = await verifyHelcimSignature(rawBody, signature, webhookId, webhookTimestamp);
  if (!valid) {
    console.error("Helcim webhook: invalid signature");
    return new Response("Invalid signature", { status: 400, headers: corsHeaders });
  }

  let event: { id?: string; type?: string; data?: any };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  const eventId = event.id;
  const eventType = event.type ?? "unknown";

  if (eventId) {
    let isNew = false;
    try {
      isNew = await claimEvent(eventId, eventType, env, event);
    } catch {
      return new Response("Event store unavailable", { status: 500, headers: corsHeaders });
    }
    if (!isNew) {
      return new Response(JSON.stringify({ received: true, deduped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    await dispatch(eventType, event.data, env);
    if (eventId) await markEventStatus(eventId, "succeeded");
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Helcim handler error:", e);
    if (eventId) {
      // Keep the row so admins can inspect + retry from the dashboard.
      await markEventStatus(eventId, "failed", { last_error: String((e as Error)?.message ?? e) });
    }
    return new Response("Handler error", { status: 500, headers: corsHeaders });
  }
});
