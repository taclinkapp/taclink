// Stripe webhook handler. Dispatches checkout.session.completed +
// account.updated for instructor Connect onboarding status.
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

async function handleCheckoutCompleted(session: any, _env: StripeEnv) {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) {
    console.warn("checkout.session.completed without bookingId metadata", session.id);
    return;
  }

  await getSupabase()
    .from("bookings")
    .update({
      deposit_status: "held_in_escrow",
      escrow_status: "held",
      escrow_held_at: new Date().toISOString(),
      stripe_payment_intent_id: session.payment_intent ?? null,
      online_total_cents: session.amount_total ?? null,
    })
    .eq("id", bookingId);
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

  try {
    const event = await verifyWebhook(req, env);
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
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
