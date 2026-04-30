// Cron-triggered: finds bookings where the instructor scanned the student
// in (attended_at IS NOT NULL) AND the course ended >24h ago AND deposit is
// still held in escrow. Transfers the 10% to the instructor's Stripe Connect
// account. Run hourly via pg_cron.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Default to sandbox; live cron should pass ?env=live.
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

  // Find releasable bookings: scanned in, course ended >24h ago, still escrowed
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from("bookings")
    .select("id, instructor_deposit_cents, stripe_payment_intent_id, courses!inner(instructor_id, ends_at)")
    .eq("deposit_status", "held_in_escrow")
    .not("attended_at", "is", null)
    .lte("courses.ends_at", cutoff)
    .limit(100);

  if (error) {
    console.error("release-escrow query error", error);
    return json({ error: error.message }, 500);
  }

  let released = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows ?? []) {
    const instructorId = (row as any).courses.instructor_id as string;
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_status")
      .eq("id", instructorId)
      .maybeSingle();

    if (!profile?.stripe_connect_account_id || profile.stripe_connect_status !== "active") {
      skipped++;
      continue;
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: row.instructor_deposit_cents,
        currency: "usd",
        destination: profile.stripe_connect_account_id,
        transfer_group: row.id,
        metadata: { bookingId: row.id, instructorId },
      });

      await supabase
        .from("bookings")
        .update({
          deposit_status: "released",
          escrow_status: "released",
          escrow_released_at: new Date().toISOString(),
          stripe_transfer_id: transfer.id,
          instructor_payout_cents: row.instructor_deposit_cents,
        })
        .eq("id", row.id);
      released++;
    } catch (e) {
      console.error("release failed for booking", row.id, e);
      errors.push(`${row.id}: ${(e as Error).message}`);
    }
  }

  return json({ released, skipped, errors });
});
