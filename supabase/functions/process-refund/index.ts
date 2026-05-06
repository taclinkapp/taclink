// Processes pending refund rows by issuing Stripe refunds against the
// original PaymentIntent. Funds come back from the PLATFORM'S Stripe
// balance (which holds the captured course payment in escrow) directly
// to the student's card. The instructor's Connect account is never
// touched — refunds never come "from the instructor".
//
// Invocation:
//   POST /process-refund?env=sandbox|live
//   Body: { refund_id?: string }   // single row, otherwise sweeps all pending
//
// A refund row is "pending" when status='issued' and stripe_refund_id IS NULL,
// OR status='failed' and last attempt is older than RETRY_AFTER_MIN.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const RETRY_AFTER_MIN = 30;
const BATCH_LIMIT = 50;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type PendingRefund = {
  id: string;
  booking_id: string;
  student_cash_refund_cents: number | null;
  amount_cents: number;
  stripe_refund_id: string | null;
  stripe_refund_status: string | null;
  bookings: { stripe_payment_intent_id: string | null } | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Authorization: allow either the shared CRON_SECRET (for pg_cron / scheduled
  // invokers) OR an authenticated admin user (for manual retries from the
  // admin refunds page).
  const expectedSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  const cronOk = !!expectedSecret && providedSecret === expectedSecret;

  let adminOk = false;
  const authHeader = req.headers.get("Authorization");
  if (!cronOk && authHeader?.startsWith("Bearer ")) {
    try {
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData } = await authClient.auth.getClaims(token);
      const userId = claimsData?.claims?.sub;
      if (userId) {
        const adminClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { data: roleRow } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        adminOk = !!roleRow;
      }
    } catch (e) {
      console.error("Admin auth check failed", e);
    }
  }

  if (!cronOk && !adminOk) {
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

  let body: { refund_id?: string } = {};
  try { body = await req.json(); } catch { /* sweep mode */ }

  const retryCutoff = new Date(Date.now() - RETRY_AFTER_MIN * 60 * 1000).toISOString();

  let query = supabase
    .from("refunds")
    .select(
      "id, booking_id, student_cash_refund_cents, amount_cents, stripe_refund_id, stripe_refund_status, bookings!inner(stripe_payment_intent_id)",
    )
    .is("stripe_refund_id", null);

  if (body.refund_id) {
    query = query.eq("id", body.refund_id);
  } else {
    query = query.or(`updated_at.lt.${retryCutoff},stripe_refund_status.is.null`)
      .limit(BATCH_LIMIT);
  }

  const { data: rows, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const pending = (rows ?? []) as unknown as PendingRefund[];
  const results: Array<Record<string, unknown>> = [];

  for (const r of pending) {
    const amount = r.student_cash_refund_cents ?? r.amount_cents;
    if (!amount || amount <= 0) {
      results.push({ refund_id: r.id, skipped: "zero amount" });
      continue;
    }
    const pi = r.bookings?.stripe_payment_intent_id;
    if (!pi) {
      await supabase
        .from("refunds")
        .update({
          status: "failed",
          stripe_refund_status: "missing_payment_intent",
          updated_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      results.push({ refund_id: r.id, error: "no payment_intent on booking" });
      continue;
    }

    try {
      const refund = await stripe.refunds.create(
        {
          payment_intent: pi,
          amount,
          reason: "requested_by_customer",
          metadata: {
            refund_row_id: r.id,
            booking_id: r.booking_id,
            source: "process-refund",
          },
        },
        // Idempotency key keeps retries safe.
        { idempotencyKey: `refund:${r.id}` },
      );

      await supabase
        .from("refunds")
        .update({
          stripe_refund_id: refund.id,
          stripe_refund_status: refund.status ?? "pending",
          status: refund.status === "failed" ? "failed" : "issued",
          external_reference: refund.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", r.id);

      results.push({ refund_id: r.id, stripe_refund_id: refund.id, status: refund.status });
    } catch (e: any) {
      console.error("Refund failed", r.id, e?.message);
      await supabase
        .from("refunds")
        .update({
          status: "failed",
          stripe_refund_status: (e?.code as string) ?? "stripe_error",
          notes: `Stripe error: ${e?.message ?? "unknown"}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      results.push({ refund_id: r.id, error: e?.message ?? "stripe error" });
    }
  }

  return json({ ok: true, processed: results.length, results });
});
