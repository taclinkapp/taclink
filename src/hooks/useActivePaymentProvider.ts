import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ActiveProvider = "stripe" | "helcim";

/**
 * Reads `payment_provider_settings.active_provider` and returns the
 * processor that NEW checkouts should route through. Defaults to
 * 'stripe' until the row is loaded so the UI never flickers a Helcim
 * prompt by accident on slow networks.
 */
export function useActivePaymentProvider() {
  const [provider, setProvider] = useState<ActiveProvider>("stripe");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any).rpc('get_active_payment_provider');
      if (cancelled) return;
      const next = (data as ActiveProvider | undefined) ?? "stripe";
      setProvider(next === "helcim" ? "helcim" : "stripe");
      setLoading(false);

    })();
    return () => { cancelled = true; };
  }, []);

  return { provider, loading };
}
