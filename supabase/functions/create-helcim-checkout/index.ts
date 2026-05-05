// Creates a HelcimPay.js checkout session for full-online booking.
// Mirrors create-escrow-checkout (Stripe) but returns a Helcim
// `checkoutToken` for the HelcimPay.js modal instead of a Stripe
// client_secret for Embedded Checkout.
//
// FULL-ONLINE MODEL: charges the student the $25 platform fee + the full
// course price into TacLink's Helcim merchant account. Instructor payout
// is tracked in instructor_ledger and paid out via weekly ACH batch
// (release-escrow-deposits + a future payout-batch worker), not at
// charge time — Helcim has no marketplace split API.
//
// STUB MODE: when HELCIM_API_TOKEN is not configured, this returns a
// fake checkoutToken so the modal UX can be exercised end-to-end and the
// failover toggle can be flipped without breaking the booking flow. Real
// payments will fail (clearly) at the modal step until the secret is
// added.
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

const HELCIM_API_BASE = "https://api.helcim.com/v2";
const HELCIM_SANDBOX_PROFILE = {
  fullName: "Andy Perez",
  phone: "7866032316",
  address: "3010 Valentina Way",
  city: "Miami",
  province: "FL",
  country: "USA",
  postalCode: "90210",
};

const isSandboxHelcim = () => {
  const env = (Deno.env.get("HELCIM_ENV") ?? Deno.env.get("VITE_HELCIM_ENV") ?? "sandbox").toLowerCase();
  return env !== "live" && env !== "production";
};

interface HelcimInitializeResponse {
  checkoutToken: string;
  secretToken: string;
}

async function initializeHelcimPay(opts: {
  apiToken: string;
  amountCents: number;
  currency: string;
  description: string;
}): Promise<HelcimInitializeResponse> {
  const res = await fetch(`${HELCIM_API_BASE}/helcim-pay/initialize`, {
    method: "POST",
    headers: {
      "api-token": opts.apiToken,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      paymentType: "purchase",
      amount: opts.amountCents / 100,
      currency: opts.currency.toUpperCase(),
      paymentMethod: "cc",
      hasConvenienceFee: 0,
      hideExistingPaymentDetails: 1,
      displayContactFields: isSandboxHelcim() ? 0 : 1,
      description: opts.description,
      ...(isSandboxHelcim() ? {
        customerRequest: {
          contactName: HELCIM_SANDBOX_PROFILE.fullName,
          cellPhone: HELCIM_SANDBOX_PROFILE.phone,
          billingAddress: {
            name: HELCIM_SANDBOX_PROFILE.fullName,
            street1: HELCIM_SANDBOX_PROFILE.address,
            city: HELCIM_SANDBOX_PROFILE.city,
            province: HELCIM_SANDBOX_PROFILE.province,
            country: HELCIM_SANDBOX_PROFILE.country,
            postalCode: HELCIM_SANDBOX_PROFILE.postalCode,
            phone: HELCIM_SANDBOX_PROFILE.phone,
          },
        },
      } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Helcim initialize failed (${res.status}): ${text}`);
  }
  return await res.json();
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
    const { bookingId, returnUrl } = body as {
      bookingId?: string;
      returnUrl?: string;
    };
    if (!bookingId || !returnUrl) {
      return json({ error: "bookingId and returnUrl required" }, 400);
    }

    // Provider gate — only run when active_provider = 'helcim'.
    const { data: providerSettings } = await supabase
      .from("payment_provider_settings")
      .select("active_provider")
      .eq("id", true)
      .maybeSingle();
    const activeProvider =
      (providerSettings?.active_provider as string | undefined) ?? "stripe";
    if (activeProvider !== "helcim") {
      return json({
        error: `Helcim checkout is disabled — platform is currently routing through ${activeProvider}.`,
      }, 503);
    }

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select(
        "id, student_id, course_id, online_total_cents, platform_fee_cents, instructor_deposit_cents, deposit_status, courses!inner(title, instructor_id)",
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (bErr || !booking) return json({ error: "Booking not found" }, 404);
    if (booking.student_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (
      booking.deposit_status === "held_in_escrow" ||
      booking.deposit_status === "released"
    ) {
      return json({ error: "Deposit already collected" }, 400);
    }

    const courseTitle = (booking as any).courses?.title ?? "TacLink Course";
    const description = `${courseTitle} — escrow charge (course price + $25 platform fee)`;
    const apiToken = Deno.env.get("HELCIM_API_TOKEN");

    let checkoutToken: string;
    let secretToken: string;
    let stub = false;

    if (apiToken) {
      const init = await initializeHelcimPay({
        apiToken,
        amountCents: booking.online_total_cents,
        currency: "usd",
        description,
      });
      checkoutToken = init.checkoutToken;
      secretToken = init.secretToken;
    } else {
      // STUB: HelcimPay.js modal will open with a fake token. The
      // payment attempt itself will fail inside Helcim's modal — that's
      // the intended signal that go-live still requires HELCIM_API_TOKEN.
      stub = true;
      checkoutToken = `stub_${booking.id}_${crypto.randomUUID()}`;
      secretToken = "stub";
      console.warn(
        "[create-helcim-checkout] HELCIM_API_TOKEN not set — returning stub checkoutToken. Add the secret before going live.",
      );
    }

    const { error: updateErr } = await supabase
      .from("bookings")
      .update({
        helcim_checkout_token: checkoutToken,
        deposit_status: "pending_payment",
        payment_provider: "helcim",
      })
      .eq("id", booking.id);
    if (updateErr) throw updateErr;

    const { error: sessionErr } = await supabase
      .from("helcim_checkout_sessions")
      .insert({
        booking_id: booking.id,
        checkout_token: checkoutToken,
        secret_token: secretToken,
        amount_cents: booking.online_total_cents,
        currency: "USD",
      });
    if (sessionErr) throw sessionErr;

    return json({
      checkoutToken,
      bookingId: booking.id,
      amountCents: booking.online_total_cents,
      returnUrl,
      stub,
    });
  } catch (e) {
    console.error("create-helcim-checkout error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
