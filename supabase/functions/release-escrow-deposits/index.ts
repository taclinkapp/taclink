// Cron-triggered (hourly): releases escrowed funds to instructors.
//
// FULL-ONLINE MODEL: TacLink charges the student the full course price
// upfront and holds it in escrow. This function transfers the full course
// price to the instructor's Stripe Connect account 24h after course end.
// TacLink keeps only the $25 platform fee.
//
// The booking column `instructor_deposit_cents` stores the payout amount
// (= full course price under the new model; was 10% under the old model).
//
// Eligibility:
//  - booking.deposit_status = 'held_in_escrow'
//  - booking.escrow_status   = 'held'
//  - booking.attended_at IS NOT NULL  (instructor scanned student in)
//  - course.ends_at + 24h <= now()
//  - instructor profile has an active Stripe Connect account
//
// Safety:
//  - Pre-claims rows by stamping release_attempted_at, so concurrent runs
//    don't double-transfer.
//  - Uses transfer_group + idempotency key derived from the booking id, so
//    Stripe also rejects duplicates server-side.
//  - On Stripe failure we record release_error and skip the row; the next
//    run can retry once the attempt is older than RETRY_AFTER_MIN.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const RETRY_AFTER_MIN = 60; // re-attempt failed transfers after 1 hour
const BATCH_LIMIT = 100;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Authorization: only allow callers presenting the shared CRON_SECRET.
  const expectedSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json({ error: "Forbidden" }, 403);
  }

  const rawEnv = new URL(req.url).searchParams.get("env") ?? "sandbox";
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    return json({ error: "invalid env" }, 400);
  }
  const env: StripeEnv = rawEnv;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const stripe = createStripeClient(env);

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const retryCutoff = new Date(Date.now() - RETRY_AFTER_MIN * 60 * 1000).toISOString();

  // Find releasable bookings. Filter on attended_at, escrow held, course
  // ended >24h ago, and no recent failed attempt.
  const { data: rows, error } = await supabase
    .from("bookings")
    .select(
      "id, instructor_deposit_cents, stripe_payment_intent_id, release_attempted_at, stripe_transfer_id, courses!inner(instructor_id, ends_at)",
    )
    .eq("deposit_status", "held_in_escrow")
    .eq("escrow_status", "held")
    .not("attended_at", "is", null)
    .gt("instructor_deposit_cents", 0)
    .lte("courses.ends_at", cutoff)
    .or(`release_attempted_at.is.null,release_attempted_at.lte.${retryCutoff}`)
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("release-escrow query error", error);
    return json({ error: error.message }, 500);
  }

  let released = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows ?? []) {
    const instructorId = (row as any).courses.instructor_id as string;

    // Pre-claim: atomically stamp release_attempted_at ONLY if no other
    // worker has stamped it more recently than retryCutoff. Without this
    // gate, two concurrent runs both pass the initial SELECT and both
    // proceed to call Stripe (idempotency-key dedupes the actual transfer
    // but we still waste the call and risk a double DB write).
    const priorAttempt = (row as any).release_attempted_at as string | null;
    const { data: claim, error: claimErr } = await supabase
      .from("bookings")
      .update({ release_attempted_at: new Date().toISOString(), release_error: null })
      .eq("id", row.id)
      .eq("escrow_status", "held")
      .eq("deposit_status", "held_in_escrow")
      .is("stripe_transfer_id", null)
      .or(
        priorAttempt
          ? `release_attempted_at.eq.${priorAttempt}`
          : `release_attempted_at.is.null`,
      )
      .select("id");
    if (claimErr || !claim?.length) {
      skipped++;
      continue;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_status")
      .eq("id", instructorId)
      .maybeSingle();

    if (!profile?.stripe_connect_account_id || profile.stripe_connect_status !== "active") {
      await supabase
        .from("bookings")
        .update({ release_error: "instructor_connect_not_active" })
        .eq("id", row.id);
      skipped++;
      continue;
    }

    // Resolve the captured charge id from the PI so Stripe can pull funds
    // from that specific charge balance entry (avoids `balance_insufficient`
    // when the platform's available balance hasn't settled yet).
    let sourceTransaction: string | undefined;
    if (row.stripe_payment_intent_id) {
      try {
        const pi = await stripe.paymentIntents.retrieve(row.stripe_payment_intent_id);
        sourceTransaction =
          (typeof pi.latest_charge === "string"
            ? pi.latest_charge
            : pi.latest_charge?.id) ?? undefined;
      } catch (e) {
        console.warn("Failed to resolve charge for booking", row.id, (e as Error).message);
      }
    }

    // Apply payout-processor transfer fee (flat 2.9% across all methods).
    // The fee is deducted from the instructor's payout — students are not
    // charged. Keep this in sync with TRANSFER_FEE_PCT in src/lib/fees.ts.
    const TRANSFER_FEE_PCT = 0.029;
    const grossAmount = row.instructor_deposit_cents;
    const transferFeeCents = Math.round(grossAmount * TRANSFER_FEE_PCT);
    const netAmount = Math.max(0, grossAmount - transferFeeCents);

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: netAmount,
          currency: "usd",
          destination: profile.stripe_connect_account_id,
          transfer_group: row.id,
          metadata: {
            bookingId: row.id,
            instructorId,
            grossCents: String(grossAmount),
            transferFeeCents: String(transferFeeCents),
            transferFeePct: String(TRANSFER_FEE_PCT),
          },
          ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
        },
        { idempotencyKey: `release_${row.id}` },
      );

      // Guard against a concurrent refund flipping the row while Stripe
      // was processing — only mark released if the row is still held.
      await supabase
        .from("bookings")
        .update({
          deposit_status: "released",
          escrow_status: "released",
          escrow_released_at: new Date().toISOString(),
          stripe_transfer_id: transfer.id,
          instructor_payout_cents: netAmount,
          release_error: null,
        })
        .eq("id", row.id)
        .eq("escrow_status", "held")
        .eq("deposit_status", "held_in_escrow");
      released++;
    } catch (e) {
      const msg = (e as Error).message ?? "transfer_failed";
      console.error("release failed for booking", row.id, msg);
      await supabase
        .from("bookings")
        .update({ release_error: msg.slice(0, 500) })
        .eq("id", row.id);
      errors.push(`${row.id}: ${msg}`);
    }
  }

  return json({ released, skipped, errors, scanned: rows?.length ?? 0 });
});
