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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-signature",
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

async function verifyHelcimSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const verifierToken = Deno.env.get("HELCIM_WEBHOOK_VERIFIER_TOKEN");
  if (!verifierToken) {
    console.error("HELCIM_WEBHOOK_VERIFIER_TOKEN not configured");
    return false;
  }
  if (!signatureHeader) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(verifierToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  // Helcim docs: hex-encoded HMAC-SHA256.
  const bytes = new Uint8Array(signed);
  const expected = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  // Constant-time comparison.
  if (expected.length !== signatureHeader.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return mismatch === 0;
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
    });
  if (!error) return true;
  if ((error as any).code === "23505") return false;
  console.error("Failed to claim Helcim event", eventId, error);
  throw error;
}

async function handleTransactionSuccess(_payload: any, _env: HelcimEnv) {
  // Phase 2: lookup booking by helcim_checkout_token, flip
  // deposit_status -> held_in_escrow, set helcim_transaction_id.
  throw new Error("Helcim transaction.success handler not yet implemented");
}

async function handleTransactionRefunded(_payload: any, _env: HelcimEnv) {
  // Phase 2: mark refund row as issued, reverse instructor_ledger entry.
  throw new Error("Helcim transaction.refunded handler not yet implemented");
}

async function handleSubscriptionEvent(_payload: any, _env: HelcimEnv) {
  // Phase 2: upsert subscriptions row keyed by helcim_subscription_id.
  throw new Error("Helcim subscription.* handler not yet implemented");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("Helcim webhook: invalid env query param:", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const env: HelcimEnv = rawEnv;

  const rawBody = await req.text();
  const signature = req.headers.get("webhook-signature");

  const valid = await verifyHelcimSignature(rawBody, signature);
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
    switch (eventType) {
      case "transaction.success":
      case "cardTransaction.success":
        await handleTransactionSuccess(event.data, env);
        break;
      case "transaction.refunded":
      case "cardTransaction.refunded":
        await handleTransactionRefunded(event.data, env);
        break;
      case "subscription.created":
      case "subscription.updated":
      case "subscription.cancelled":
      case "subscription.payment_succeeded":
      case "subscription.payment_failed":
        await handleSubscriptionEvent(event.data, env);
        break;
      default:
        console.log("Unhandled Helcim event:", eventType);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Helcim handler error:", e);
    if (eventId) {
      await getSupabase().from("helcim_webhook_events").delete().eq("event_id", eventId);
    }
    return new Response("Handler error", { status: 500, headers: corsHeaders });
  }
});
