// Provider-neutral payment environment helper. Reads the same publishable
// token convention (pk_test_* = sandbox) but exposes no provider-specific
// names so the instructor/student UI never leaks "Stripe" into copy or
// imports. The admin failover card is the only place where the underlying
// processor identity is exposed.
const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export type PaymentEnv = "sandbox" | "live";

export const paymentEnvironment: PaymentEnv = clientToken?.startsWith("pk_test_")
  ? "sandbox"
  : "live";

export function getPaymentEnvironment(): PaymentEnv {
  return paymentEnvironment;
}
