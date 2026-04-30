// Creates a Stripe Embedded Checkout session for the booking deposit.
// Charges $25 platform fee + 10% deposit. The 10% is held in TacLink's
// Stripe balance until release-escrow-deposits transfers it to the
// instructor's Connect account 24h after the course ends.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

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
    const { bookingId, returnUrl, environment } = body as {
      bookingId?: string;
      returnUrl?: string;
      environment?: StripeEnv;
    };

    if (!bookingId || !returnUrl || (environment !== "sandbox" && environment !== "live")) {
      return json({ error: "bookingId, returnUrl, environment required" }, 400);
    }

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, student_id, course_id, online_total_cents, platform_fee_cents, instructor_deposit_cents, deposit_status, courses!inner(title, instructor_id)")
      .eq("id", bookingId)
      .maybeSingle();

    if (bErr || !booking) return json({ error: "Booking not found" }, 404);
    if (booking.student_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (booking.deposit_status === "held_in_escrow" || booking.deposit_status === "released") {
      return json({ error: "Deposit already collected" }, 400);
    }

    const stripe = createStripeClient(environment);
    const courseTitle = (booking as any).courses?.title ?? "TacLink Course";

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page",
      mode: "payment",
      return_url: returnUrl,
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `${courseTitle} — Platform fee` },
            unit_amount: booking.platform_fee_cents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            product_data: { name: `${courseTitle} — 10% deposit (held in escrow)` },
            unit_amount: booking.instructor_deposit_cents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        metadata: {
          bookingId: booking.id,
          studentId: booking.student_id,
          courseId: booking.course_id,
          instructorId: (booking as any).courses.instructor_id,
          depositCents: String(booking.instructor_deposit_cents),
        },
      },
      metadata: {
        bookingId: booking.id,
        studentId: booking.student_id,
        courseId: booking.course_id,
      },
    });

    await supabase
      .from("bookings")
      .update({
        stripe_checkout_session_id: session.id,
        deposit_status: "pending_payment",
      })
      .eq("id", booking.id);

    return json({ clientSecret: session.client_secret });
  } catch (e) {
    console.error("create-escrow-checkout error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
