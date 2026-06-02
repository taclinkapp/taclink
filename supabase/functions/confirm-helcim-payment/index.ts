import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const hex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256(input: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)));
}

function normalizeHelcimMessage(raw: unknown): { data: Record<string, unknown>; hash: string } {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const candidate = (parsed as any)?.data?.hash && (parsed as any)?.data?.data
    ? (parsed as any).data
    : parsed;
  const data = (candidate as any)?.data;
  const hash = (candidate as any)?.hash;
  if (!data || typeof data !== "object" || typeof hash !== "string") {
    throw new Error("Invalid Helcim success payload");
  }
  return { data, hash };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { bookingId, checkoutToken, eventMessage } = body as {
      bookingId?: string;
      checkoutToken?: string;
      eventMessage?: unknown;
    };
    if (!bookingId || !checkoutToken || !eventMessage) {
      return json({ error: "bookingId, checkoutToken, and eventMessage required" }, 400);
    }

    const { data: session, error: sessionErr } = await supabase
      .from("helcim_checkout_sessions")
      .select("id, booking_id, checkout_token, secret_token, amount_cents, currency, status")
      .eq("booking_id", bookingId)
      .eq("checkout_token", checkoutToken)
      .maybeSingle();
    if (sessionErr || !session) return json({ error: "Payment session not found" }, 404);

    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, student_id, course_id, course_price_cents, instructor_payout_cents, escrow_status, deposit_status, online_total_cents")
      .eq("id", bookingId)
      .maybeSingle();
    if (bookingErr || !booking) return json({ error: "Booking not found" }, 404);
    if (booking.student_id !== user.id) return json({ error: "Forbidden" }, 403);

    const response = normalizeHelcimMessage(eventMessage);
    const expectedHash = await sha256(JSON.stringify(response.data) + session.secret_token);
    if (expectedHash !== response.hash) {
      await supabase.from("helcim_checkout_sessions").update({ status: "failed", raw_response: response }).eq("id", session.id);
      return json({ error: "Payment validation failed" }, 400);
    }

    const transactionId = String((response.data as any).transactionId ?? "").trim();
    const status = String((response.data as any).status ?? "").toUpperCase();
    const amountCents = Math.round(Number((response.data as any).amount ?? 0) * 100);
    const currency = String((response.data as any).currency ?? session.currency).toUpperCase();

    if (!transactionId || !status.startsWith("APPROV") || amountCents !== session.amount_cents || currency !== session.currency.toUpperCase()) {
      await supabase.from("helcim_checkout_sessions").update({ status: "failed", raw_response: response }).eq("id", session.id);
      return json({ error: "Payment response did not match this booking" }, 400);
    }

    const now = new Date().toISOString();
    await supabase.from("helcim_checkout_sessions").update({
      status: "confirmed",
      helcim_transaction_id: transactionId,
      raw_response: response,
      confirmed_at: now,
    }).eq("id", session.id);

    if (booking.escrow_status !== "held" && booking.escrow_status !== "released") {
      const { error: updateErr } = await supabase.from("bookings").update({
        helcim_transaction_id: transactionId,
        deposit_status: "held_in_escrow",
        escrow_status: "held",
        escrow_held_at: now,
        payment_provider: "helcim",
        updated_at: now,
      }).eq("id", booking.id).in("deposit_status", ["pending_payment", "pending_send"]);
      if (updateErr) throw updateErr;
    }

    const { data: course } = await supabase
      .from("courses")
      .select("instructor_id, ends_at, starts_at")
      .eq("id", booking.course_id)
      .maybeSingle();

    const owedCents = booking.instructor_payout_cents > 0 ? booking.instructor_payout_cents : booking.course_price_cents;
    if (course?.instructor_id && owedCents > 0) {
      const endsAt = course.ends_at ?? course.starts_at;
      const availableAt = endsAt ? new Date(new Date(endsAt).getTime() + 24 * 3600 * 1000).toISOString() : null;
      // Race-safe: relies on the unique partial index on (booking_id) WHERE
      // entry_type='owed'. If the webhook beat us to it, swallow 23505.
      const { error: insErr } = await supabase.from("instructor_ledger").insert({
        instructor_id: course.instructor_id,
        booking_id: booking.id,
        provider: "helcim",
        entry_type: "owed",
        amount_cents: owedCents,
        currency: currency.toLowerCase(),
        available_at: availableAt,
        notes: `Helcim transaction ${transactionId}`,
      });
      if (insErr && (insErr as any).code !== "23505") {
        console.error("ledger insert error", insErr);
      }
    }

    return json({ confirmed: true, bookingId: booking.id, transactionId });
  } catch (e) {
    console.error("confirm-helcim-payment error", e);
    return json({ error: (e as Error).message }, 500);
  }
});