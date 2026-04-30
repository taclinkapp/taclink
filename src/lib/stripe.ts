import { loadStripe, Stripe } from "@stripe/stripe-js";

type StripeEnv = "sandbox" | "live";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export const stripeEnvironment: StripeEnv = clientToken?.startsWith("pk_test_")
  ? "sandbox"
  : "live";

export function getStripeEnvironment(): StripeEnv {
  return stripeEnvironment;
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    if (!clientToken) {
      throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");
    }
    stripePromise = loadStripe(clientToken);
  }
  return stripePromise;
}

export const isStripeConfigured = !!clientToken;
