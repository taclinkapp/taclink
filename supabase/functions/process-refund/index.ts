// Processes pending refund rows by issuing Helcim refunds against the
// original card transaction. Funds come back from the platform's Helcim
// merchant account directly to the student's card. The instructor's
// payout ledger is reversed by the helcim webhook handler — this function
// just calls Helcim and updates the refunds row.
//
// Invocation:
//   POST /process-refund
//   Body: { refund_id?: string }   // single row, otherwise sweeps all pending
//
// A refund row is "pending" when status='issued' and external_reference IS NULL,
// OR status='failed' and last attempt is older than RETRY_AFTER_MIN.
//
// Auth: either x-cron-secret header (for pg_cron) OR an admin user JWT.
import { createClient } from "npm:@supabase/supabase-js@2";

const RETRY_AFTER_MIN = 30;
const BATCH_LIMIT = 50;
const HELCIM_API_BASE = "https://api.helcim.com/v2";

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
  external_reference: string | null;
  stripe_refund_status: string | null;
};

async function helcimCall(
  endpoint: "refund" | "reverse",
  apiToken: string,
  txnId: string,
  amountCents: number,
  idempotencyKey: string,
) {
  const body: Record<string, unknown> =
    endpoint === "refund"
      ? {
          originalTransactionId: Number(txnId),
          amount: (amountCents / 100).toFixed(2),
          ipAddress: "0.0.0.0",
        }
      : {
          cardTransactionId: Number(txnId),
          ipAddress: "0.0.0.0",
        };
  const res = await fetch(`${HELCIM_API_BASE}/payment/${endpoint}`, {
    method: "POST",
    headers: {
      "api-token": apiToken,
      "content-type": "application/json",
      accept: "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  return { ok: res.ok, status: res.status, body: parsed, endpoint };
}

async function callHelcimRefund(
  apiToken: string,
  txnId: string,
  amountCents: number,
  idempotencyKey: string,
) {
  let r = await helcimCall("refund", apiToken, txnId, amountCents, idempotencyKey);
  const errStr = JSON.stringify((r.body as any)?.errors ?? "").toLowerCase();
  if (!r.ok && (errStr.includes("cannot be refunded") || errStr.includes("not settled") || errStr.includes("unsettled"))) {
    const revKey = `rv${idempotencyKey.slice(2, 25)}`.padEnd(25, "0").slice(0, 25);
    r = await helcimCall("reverse", apiToken, txnId, amountCents, revKey);
  }
  return r;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Auth: cron secret OR admin JWT
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

  const apiToken = Deno.env.get("HELCIM_API_TOKEN")?.trim().replace(/^["']|["']$/g, "");
  if (!apiToken) return json({ error: "HELCIM_API_TOKEN not configured" }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { refund_id?: string } = {};
  try { body = await req.json(); } catch { /* sweep mode */ }

  const retryCutoff = new Date(Date.now() - RETRY_AFTER_MIN * 60 * 1000).toISOString();

  let query = supabase
    .from("refunds")
    .select(
      "id, booking_id, student_cash_refund_cents, amount_cents, external_reference, stripe_refund_status",
    )
    .is("external_reference", null);

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

  // Fetch helcim_transaction_id for all bookings in one query
  const bookingIds = Array.from(new Set(pending.map((r) => r.booking_id)));
  const txnByBooking = new Map<string, string | null>();
  if (bookingIds.length > 0) {
    const { data: bRows } = await supabase
      .from("bookings")
      .select("id, helcim_transaction_id")
      .in("id", bookingIds);
    for (const b of bRows ?? []) {
      txnByBooking.set((b as any).id, (b as any).helcim_transaction_id ?? null);
    }
  }

  for (const r of pending) {
    const amount = r.student_cash_refund_cents ?? r.amount_cents;
    if (!amount || amount <= 0) {
      results.push({ refund_id: r.id, skipped: "zero amount" });
      continue;
    }
    const txnId = txnByBooking.get(r.booking_id) ?? null;

    if (!txnId) {
      await supabase
        .from("refunds")
        .update({
          status: "failed",
          stripe_refund_status: "missing_helcim_transaction",
          notes: "Booking has no helcim_transaction_id — cannot refund",
          updated_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      results.push({ refund_id: r.id, error: "no helcim_transaction_id on booking" });
      continue;
    }

    // Idempotency key must be exactly 25 chars
    const idemKey = `pr${r.id.replace(/-/g, "").slice(0, 23)}`;

    try {
      const helcimResp = await callHelcimRefund(apiToken, txnId, amount, idemKey);
      const helcimTxnId = (helcimResp.body as any)?.transactionId ??
        (helcimResp.body as any)?.data?.transactionId ?? null;

      if (!helcimResp.ok) {
        const errStr = JSON.stringify((helcimResp.body as any)?.errors ?? "").toLowerCase();
        const alreadyDone =
          errStr.includes("cannot be refunded") ||
          errStr.includes("cannot be reversed") ||
          errStr.includes("already refunded") ||
          errStr.includes("already reversed");

        await supabase
          .from("refunds")
          .update({
            status: "failed",
            stripe_refund_status: alreadyDone ? "already_refunded" : "helcim_api_error",
            notes: `Helcim API ${helcimResp.status}: ${JSON.stringify(helcimResp.body).slice(0, 500)}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", r.id);

        results.push({
          refund_id: r.id,
          error: `helcim ${helcimResp.status}`,
          already_refunded: alreadyDone,
        });
        continue;
      }

      await supabase
        .from("refunds")
        .update({
          status: "issued",
          stripe_refund_status: "succeeded",
          external_reference: helcimTxnId ? String(helcimTxnId) : `helcim:${idemKey}`,
          notes: `Helcim ${helcimResp.endpoint} OK (txn ${helcimTxnId ?? "?"})`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", r.id);

      results.push({
        refund_id: r.id,
        helcim_refund_txn_id: helcimTxnId,
        endpoint: helcimResp.endpoint,
      });
    } catch (e: any) {
      console.error("Refund failed", r.id, e?.message);
      await supabase
        .from("refunds")
        .update({
          status: "failed",
          stripe_refund_status: "helcim_error",
          notes: `Helcim error: ${e?.message ?? "unknown"}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      results.push({ refund_id: r.id, error: e?.message ?? "helcim error" });
    }
  }

  return json({ ok: true, processed: results.length, results });
});
