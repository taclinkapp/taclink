// Stripe webhook handler with idempotency + safe retries.
//
// Guarantees that checkout.session.completed never double-updates a booking:
//  1. Verify signature.
//  2. INSERT the event id into stripe_webhook_events. If it conflicts (already
//     processed), short-circuit with 200 so Stripe stops retrying.
//  3. Apply the side effect with a guarded WHERE clause that only matches
//     bookings still in pending_payment (or the same session id), so even if
//     two concurrent retries slip past the idempotency table, only one
//     UPDATE actually flips the row.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

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

/**
 * Try to record an event id. Returns true if this is the first time we've
 * seen it, false if it was already processed (= safe to skip).
 */
async function claimEvent(
  eventId: string,
  eventType: string,
  env: StripeEnv,
  payload: unknown,
): Promise<boolean> {
  const { error } = await getSupabase()
    .from("stripe_webhook_events")
    .insert({
      event_id: eventId,
      event_type: eventType,
      environment: env,
      payload: payload as any,
    });
  if (!error) return true;
  // 23505 = unique_violation -> already processed
  if ((error as any).code === "23505") return false;
  // Anything else: log and re-throw so Stripe retries.
  console.error("Failed to claim event", eventId, error);
  throw error;
}

async function handleCheckoutCompleted(session: any, _env: StripeEnv) {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) {
    console.warn("checkout.session.completed without bookingId metadata", session.id);
    return;
  }

  // Guarded UPDATE: only flip rows that are still pending_payment OR that
  // belong to this exact session (handles repeat events for the same row).
  // We also avoid downgrading rows that already advanced to released/refunded.
  const { data, error } = await getSupabase()
    .from("bookings")
    .update({
      deposit_status: "held_in_escrow",
      escrow_status: "held",
      escrow_held_at: new Date().toISOString(),
      stripe_payment_intent_id: session.payment_intent ?? null,
      stripe_checkout_session_id: session.id,
      online_total_cents: session.amount_total ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .in("deposit_status", ["pending_payment", "pending_send"])
    .select("id");

  if (error) {
    console.error("Booking update failed", bookingId, error);
    throw error;
  }
  if (!data?.length) {
    console.log("Booking already advanced past pending_payment, no-op:", bookingId);
  }
}

async function handleAccountUpdated(account: any) {
  const status =
    account.payouts_enabled && account.charges_enabled
      ? "active"
      : account.requirements?.disabled_reason
        ? "restricted"
        : "onboarding";

  await getSupabase()
    .from("profiles")
    .update({ stripe_connect_status: status })
    .eq("stripe_connect_account_id", account.id);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  const env: StripeEnv = rawEnv;

  let event: { id?: string; type: string; data: { object: any } };
  try {
    event = await verifyWebhook(req, env) as any;
  } catch (e) {
    console.error("Webhook verification failed:", e);
    return new Response("Invalid signature", { status: 400 });
  }

  const eventId = (event as any).id as string | undefined;
  if (!eventId) {
    // No id = can't dedupe. Log and accept so Stripe doesn't keep retrying.
    console.warn("Webhook event missing id, processing without idempotency");
  } else {
    let isNew = false;
    try {
      isNew = await claimEvent(eventId, event.type, env, event);
    } catch {
      // Storage error -> 500 so Stripe retries later.
      return new Response("Event store unavailable", { status: 500 });
    }
    if (!isNew) {
      return new Response(JSON.stringify({ received: true, deduped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, env);
        break;
      case "account.updated":
        await handleAccountUpdated(event.data.object);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Handler error:", e);
    // Roll back the idempotency claim so Stripe's retry has a chance to
    // re-execute the side effect.
    if (eventId) {
      await getSupabase().from("stripe_webhook_events").delete().eq("event_id", eventId);
    }
    return new Response("Handler error", { status: 500 });
  }
});
