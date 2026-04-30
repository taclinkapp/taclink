import { useCallback } from "react";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { getStripe, stripeEnvironment } from "@/lib/stripe";

interface Props {
  bookingId: string;
  returnUrl: string;
}

/**
 * Embedded Stripe Checkout for the TacLink escrow charge.
 * Charges $25 platform fee + 100% course price upfront. The course price is
 * held in TacLink's Stripe balance; release-escrow-deposits transfers it to
 * the instructor's Connect account 24h after the course ends.
 */
export const EscrowCheckout = ({ bookingId, returnUrl }: Props) => {
  const fetchClientSecret = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke(
      "create-escrow-checkout",
      {
        body: { bookingId, returnUrl, environment: stripeEnvironment },
      },
    );
    if (error || !data?.clientSecret) {
      throw new Error(error?.message ?? "Failed to start checkout");
    }
    return data.clientSecret as string;
  }, [bookingId, returnUrl]);

  return (
    <div id="stripe-embedded-checkout" className="rounded-md overflow-hidden">
      <EmbeddedCheckoutProvider
        stripe={getStripe()}
        options={{ fetchClientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
};
