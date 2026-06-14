// Creates an embedded Stripe Checkout session for the Instructor Pro subscription.
//
// SECURITY: requires a valid user JWT. The `userId` written into Stripe
// metadata is derived from the verified JWT, NEVER from the request body.
// This prevents an attacker from creating a paid subscription and attributing
// it to a different user.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { isPrelaunchEnabled } from "../_shared/prelaunch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // --- Auth: require a valid Bearer JWT and derive userId/email from claims.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(sbUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
    const claims = claimsData?.claims;
    if (claimsErr || !claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.sub as string;
    const verifiedEmail = (claims.email as string | undefined) ?? null;

    const body = await req.json();
    const { priceId, returnUrl, environment } = body ?? {};

    if (!priceId || typeof priceId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(priceId)) {
      return new Response(JSON.stringify({ error: "Invalid priceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!returnUrl || typeof returnUrl !== "string") {
      return new Response(JSON.stringify({ error: "Missing returnUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (environment !== "sandbox" && environment !== "live") {
      return new Response(JSON.stringify({ error: "Invalid environment" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hard server-side block during pre-launch. The UI also disables the
    // upgrade button, but this guarantees no client (curl, replay, race)
    // can create a Pro subscription before launch day.
    if (await isPrelaunchEnabled()) {
      return new Response(
        JSON.stringify({ error: "Pro subscriptions are not yet available — we're still in pre-launch." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Admin lock check: reject if the plan is locked or inactive in our DB.
    try {
      const planRes = await fetch(
        `${sbUrl}/rest/v1/subscription_plans?slug=eq.${encodeURIComponent(priceId)}&select=locked,active,locked_reason`,
        { headers: { apikey: anon, Authorization: `Bearer ${anon}` } },
      );
      if (planRes.ok) {
        const rows = (await planRes.json()) as Array<{ locked: boolean; active: boolean; locked_reason: string | null }>;
        const plan = rows?.[0];
        if (plan && (plan.locked || !plan.active)) {
          return new Response(
            JSON.stringify({
              error: plan.locked_reason || "This plan is currently unavailable.",
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    } catch (e) {
      console.error("plan lock check failed:", e);
    }

    const env: StripeEnv = environment;
    const stripe = createStripeClient(env);

    const prices = await stripe.prices.list({ lookup_keys: [priceId] });
    if (!prices.data.length) {
      return new Response(JSON.stringify({ error: "Price not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      ...(verifiedEmail && { customer_email: verifiedEmail }),
      metadata: { userId },
      ...(isRecurring && { subscription_data: { metadata: { userId } } }),
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-subscription-checkout error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
