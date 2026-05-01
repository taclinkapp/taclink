// Creates a Stripe Connect Express account for the instructor (if not yet
// created) and returns an account-link URL that takes them through KYC /
// payout setup. Called from the instructor's PayoutMethods screen.
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
    const { returnUrl, refreshUrl, environment } = body as {
      returnUrl?: string;
      refreshUrl?: string;
      environment?: StripeEnv;
    };
    if (!returnUrl || !refreshUrl || (environment !== "sandbox" && environment !== "live")) {
      return json({ error: "returnUrl, refreshUrl, environment required" }, 400);
    }

    const stripe = createStripeClient(environment);

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("id", user.id)
      .maybeSingle();

    let accountId = profile?.stripe_connect_account_id as string | undefined;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: { instructorId: user.id },
      });
      accountId = account.id;
      // Keep both legacy column on profiles AND the new provider-agnostic
      // table in sync so the failover layer sees this account.
      await supabase
        .from("profiles")
        .update({
          stripe_connect_account_id: accountId,
          stripe_connect_status: "onboarding",
        })
        .eq("id", user.id);
      await supabase
        .from("instructor_payout_accounts")
        .upsert({
          instructor_id: user.id,
          provider: "stripe",
          external_account_id: accountId,
          status: "onboarding",
        }, { onConflict: "instructor_id,provider" });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });

    return json({ url: link.url, accountId });
  } catch (e) {
    console.error("create-connect-onboarding error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
