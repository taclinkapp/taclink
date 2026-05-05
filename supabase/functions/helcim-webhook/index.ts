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
