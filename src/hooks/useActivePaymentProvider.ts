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
      const { data } = await supabase
        .from("payment_provider_settings")
        .select("active_provider")
        .eq("id", true)
        .maybeSingle();
      if (cancelled) return;
      const next = (data?.active_provider as ActiveProvider | undefined) ?? "stripe";
      setProvider(next === "helcim" ? "helcim" : "stripe");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { provider, loading };
}
