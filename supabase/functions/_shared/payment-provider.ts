// =====================================================================
// PaymentProvider abstraction
// ---------------------------------------------------------------------
// Single interface every payment rail must implement. Helcim is the
// designated PRIMARY processor going forward; Stripe stays as the
// active default until the Helcim adapter is wired in (HelcimPay.js
// modal + ledger-based payouts) and HELCIM_API_TOKEN is provisioned.
//
// Edge functions should ONLY talk to the active provider through
// `getActivePaymentProvider()` — never import a specific adapter
// directly. That keeps failover to a single DB flip.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "./stripe.ts";

export type ProviderName = "stripe" | "helcim";

export interface CheckoutSessionInput {
  bookingId?: string;
  priceId?: string;          // human-readable price id (subscriptions)
  amountCents?: number;      // dynamic amounts (escrow, donations)
  currency?: string;
  customerEmail?: string;
  userId?: string;
  returnUrl: string;
  mode: "payment" | "subscription";
  // Marketplace split (instructor payout) — only honored when the
  // provider supports native splits. Helcim path will record an
  // "owed" ledger entry instead (TacLink-side ledger model).
  instructorPayoutAccountId?: string;
  instructorPayoutCents?: number;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  clientSecret?: string;     // Stripe embedded checkout
  helcimCheckoutToken?: string; // HelcimPay.js modal token
  hostedUrl?: string;        // hosted-redirect fallback
  externalSessionId: string;
  provider: ProviderName;
}

export interface PayoutOnboardingInput {
  instructorId: string;
  email?: string;
  returnUrl: string;
  refreshUrl: string;
}

export interface PayoutOnboardingResult {
  url: string;
  externalAccountId: string;
}

export interface RefundInput {
  bookingId: string;
  externalChargeId: string;
  amountCents: number;
  reason?: string;
}

export interface RefundResult {
  externalRefundId: string;
  amountCents: number;
  status: "issued" | "pending" | "failed";
}

export interface PaymentProvider {
  readonly name: ProviderName;

  // Embedded checkout (escrow charges, subscription signup, etc.)
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;

  // Payout-account onboarding (Stripe Connect / Helcim payee record)
  createPayoutOnboarding(input: PayoutOnboardingInput): Promise<PayoutOnboardingResult>;

  // Issue refund
  issueRefund(input: RefundInput): Promise<RefundResult>;

  // Customer billing portal (subscription self-service)
  createPortalSession(opts: { externalCustomerId: string; returnUrl: string }): Promise<{ url: string }>;

  // Verify a webhook payload — returns parsed event or throws.
  verifyWebhook(req: Request): Promise<{ type: string; data: { object: any } }>;

  // True if this provider can split payouts to instructor accounts at
  // charge time. Stripe Connect = true. Helcim = false (we use the
  // instructor_ledger table to track owed balances and run weekly
  // ACH payout batches instead).
  readonly supportsNativeSplit: boolean;
}

// ---------------------------------------------------------------------
// Stripe adapter — thin wrapper around the existing _shared/stripe.ts
// utilities. Stays as the active default + designated backup rail.
// ---------------------------------------------------------------------

class StripeProvider implements PaymentProvider {
  readonly name: ProviderName = "stripe";
  readonly supportsNativeSplit = true;

  constructor(private env: StripeEnv) {}

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    const stripe = createStripeClient(this.env);

    let lineItem: any;
    if (input.mode === "subscription" && input.priceId) {
      const prices = await stripe.prices.list({ lookup_keys: [input.priceId] });
      if (!prices.data.length) throw new Error(`Stripe price not found: ${input.priceId}`);
      lineItem = { price: prices.data[0].id, quantity: 1 };
    } else if (input.amountCents) {
      lineItem = {
        price_data: {
          currency: input.currency ?? "usd",
          product_data: { name: input.metadata?.productName ?? "TacLink charge" },
          unit_amount: input.amountCents,
        },
        quantity: 1,
      };
    } else {
      throw new Error("Stripe checkout: priceId or amountCents required");
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [lineItem],
      mode: input.mode,
      ui_mode: "embedded_page",
      return_url: input.returnUrl,
      ...(input.customerEmail && { customer_email: input.customerEmail }),
      metadata: { ...(input.metadata ?? {}), ...(input.userId ? { userId: input.userId } : {}) },
      ...(input.mode === "subscription" && input.userId && {
        subscription_data: { metadata: { userId: input.userId } },
      }),
    });

    return {
      clientSecret: session.client_secret ?? undefined,
      externalSessionId: session.id,
      provider: "stripe",
    };
  }

  async createPayoutOnboarding(input: PayoutOnboardingInput): Promise<PayoutOnboardingResult> {
    const stripe = createStripeClient(this.env);
    const supabase = getServiceClient();

    const { data: row } = await supabase
      .from("instructor_payout_accounts")
      .select("external_account_id")
      .eq("instructor_id", input.instructorId)
      .eq("provider", "stripe")
      .maybeSingle();

    let accountId = row?.external_account_id as string | undefined;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: input.email,
        capabilities: { transfers: { requested: true } },
        metadata: { instructorId: input.instructorId },
      });
      accountId = account.id;
      await supabase.from("instructor_payout_accounts").upsert({
        instructor_id: input.instructorId,
        provider: "stripe",
        external_account_id: accountId,
        status: "onboarding",
      }, { onConflict: "instructor_id,provider" });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: input.returnUrl,
      refresh_url: input.refreshUrl,
    });
    return { url: link.url, externalAccountId: accountId };
  }

  async issueRefund(input: RefundInput): Promise<RefundResult> {
    const stripe = createStripeClient(this.env);
    const refund = await stripe.refunds.create({
      payment_intent: input.externalChargeId,
      amount: input.amountCents,
      reason: "requested_by_customer",
      metadata: { bookingId: input.bookingId, reason: input.reason ?? "" },
    });
    return {
      externalRefundId: refund.id,
      amountCents: refund.amount ?? input.amountCents,
      status: refund.status === "succeeded" ? "issued" : refund.status === "pending" ? "pending" : "failed",
    };
  }

  async createPortalSession(opts: { externalCustomerId: string; returnUrl: string }): Promise<{ url: string }> {
    const stripe = createStripeClient(this.env);
    const portal = await stripe.billingPortal.sessions.create({
      customer: opts.externalCustomerId,
      return_url: opts.returnUrl,
    });
    return { url: portal.url };
  }

  async verifyWebhook(req: Request): Promise<{ type: string; data: { object: any } }> {
    const { verifyWebhook } = await import("./stripe.ts");
    return verifyWebhook(req, this.env);
  }
}

// ---------------------------------------------------------------------
// Helcim adapter — STUB. Throws clearly until merchant account is
// approved and HELCIM_API_TOKEN + HELCIM_WEBHOOK_VERIFIER_TOKEN are
// added as edge function secrets. The shape is locked so the real
// implementation drops in without touching callers.
//
// Phase 2 implementation plan (when credentials land):
//   • createCheckoutSession → POST /v2/helcim-pay/initialize
//       returns { checkoutToken, secretToken } for HelcimPay.js modal
//   • createPayoutOnboarding → noop / record in instructor_payout_accounts;
//       Helcim has no marketplace API — payouts run weekly via the
//       instructor_ledger ACH batch, not at charge time
//   • issueRefund → POST /v2/payment/refund with original transactionId
//   • createPortalSession → not supported; redirect to in-app
//       subscription page (cancel/update via our own UI + Helcim
//       Recurring API server-side)
//   • verifyWebhook → HMAC-SHA256 of raw body using
//       HELCIM_WEBHOOK_VERIFIER_TOKEN, compared to webhook-signature header
// ---------------------------------------------------------------------

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

class HelcimProvider implements PaymentProvider {
  readonly name: ProviderName = "helcim";
  readonly supportsNativeSplit = false; // marketplace splits handled via instructor_ledger

  private notConfigured(method: string): never {
    throw new Error(
      `Helcim adapter not yet configured (${method}). ` +
      `Add HELCIM_API_TOKEN and HELCIM_WEBHOOK_VERIFIER_TOKEN secrets, ` +
      `then complete Phase 2 of the failover plan and set helcim_configured = true.`,
    );
  }

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    if (!input.amountCents) {
      throw new Error("Helcim checkout requires amountCents (priceId-based subscriptions are TODO)");
    }
    const apiToken = Deno.env.get("HELCIM_API_TOKEN");
    if (!apiToken) {
      // STUB MODE — keeps the failover toggle usable end-to-end.
      const checkoutToken = `stub_${input.bookingId ?? "session"}_${crypto.randomUUID()}`;
      return {
        helcimCheckoutToken: checkoutToken,
        externalSessionId: checkoutToken,
        provider: "helcim",
      };
    }

    const res = await fetch("https://api.helcim.com/v2/helcim-pay/initialize", {
      method: "POST",
      headers: {
        "api-token": apiToken,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        paymentType: "purchase",
        amount: input.amountCents / 100,
        currency: (input.currency ?? "usd").toUpperCase(),
        paymentMethod: "cc",
        hasConvenienceFee: 0,
        hideExistingPaymentDetails: 1,
        displayContactFields: isSandboxHelcim() ? 0 : 1,
        description: input.metadata?.productName ?? "TacLink charge",
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
    const body = await res.json();
    return {
      helcimCheckoutToken: body.checkoutToken,
      externalSessionId: body.checkoutToken,
      provider: "helcim",
    };
  }

  createPayoutOnboarding(_input: PayoutOnboardingInput): Promise<PayoutOnboardingResult> {
    return Promise.reject(this.notConfigured("createPayoutOnboarding"));
  }
  issueRefund(_input: RefundInput): Promise<RefundResult> {
    return Promise.reject(this.notConfigured("issueRefund"));
  }
  createPortalSession(_opts: { externalCustomerId: string; returnUrl: string }): Promise<{ url: string }> {
    return Promise.reject(this.notConfigured("createPortalSession"));
  }
  verifyWebhook(_req: Request): Promise<{ type: string; data: { object: any } }> {
    return Promise.reject(this.notConfigured("verifyWebhook"));
  }
}

// ---------------------------------------------------------------------
// Factory + active-provider lookup
// ---------------------------------------------------------------------

let _client: ReturnType<typeof createClient> | null = null;
function getServiceClient() {
  if (!_client) {
    _client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _client;
}

export function getProviderByName(name: ProviderName, env: StripeEnv): PaymentProvider {
  switch (name) {
    case "stripe": return new StripeProvider(env);
    case "helcim": return new HelcimProvider();
    default: throw new Error(`Unknown payment provider: ${name}`);
  }
}

/**
 * Read the active provider from `payment_provider_settings` and return
 * a ready-to-use adapter. Edge functions that don't care which provider
 * is active should use this instead of constructing one directly.
 */
export async function getActivePaymentProvider(env: StripeEnv): Promise<PaymentProvider> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("payment_provider_settings")
    .select("active_provider")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    console.error("Failed to read payment_provider_settings:", error);
  }
  const name = (data?.active_provider as ProviderName | undefined) ?? "stripe";
  return getProviderByName(name, env);
}
