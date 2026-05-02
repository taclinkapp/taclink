import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  bookingId: string;
  returnUrl: string;
}

const HELCIM_PAY_SCRIPT = "https://secure.helcim.app/helcim-pay/services/start.js";

declare global {
  interface Window {
    appendHelcimPayIframe?: (token: string) => void;
    removeHelcimPayIframe?: () => void;
  }
}

/**
 * HelcimPay.js modal wrapper for the TacLink escrow charge.
 *
 * Mirrors EscrowCheckout (Stripe Embedded) but uses Helcim's hosted
 * modal instead. We:
 *   1. POST to create-helcim-checkout to get a `checkoutToken`.
 *   2. Inject the HelcimPay script if not already loaded.
 *   3. Call appendHelcimPayIframe(token) to open the modal.
 *   4. Listen for the postMessage success event, then route to returnUrl.
 *
 * The payments-webhook flips deposit_status to held_in_escrow async,
 * exactly like the Stripe path — the return page polls and waits.
 */
export const HelcimEscrowCheckout = ({ bookingId, returnUrl }: Props) => {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stub, setStub] = useState(false);
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;

    let cancelled = false;

    const onMessage = (event: MessageEvent) => {
      // Helcim emits messages whose `data.eventName` starts with the
      // checkoutToken. Status is in `data.eventStatus`.
      const payload = event.data;
      if (!payload || typeof payload !== "object") return;
      const status = payload.eventStatus ?? payload.status;
      if (status === "SUCCESS" || status === "ABORTED" || status === "HIDE") {
        try { window.removeHelcimPayIframe?.(); } catch { /* noop */ }
        if (status === "SUCCESS") {
          window.location.href = returnUrl;
        }
      }
    };

    const ensureScript = (): Promise<void> =>
      new Promise((resolve, reject) => {
        if (window.appendHelcimPayIframe) return resolve();
        const existing = document.querySelector(
          `script[src="${HELCIM_PAY_SCRIPT}"]`,
        ) as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("Failed to load HelcimPay.js")));
          return;
        }
        const s = document.createElement("script");
        s.src = HELCIM_PAY_SCRIPT;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Failed to load HelcimPay.js"));
        document.head.appendChild(s);
      });

    (async () => {
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke(
          "create-helcim-checkout",
          { body: { bookingId, returnUrl } },
        );
        if (cancelled) return;
        if (invokeErr || !data?.checkoutToken) {
          throw new Error(invokeErr?.message ?? "Failed to start Helcim checkout");
        }
        setStub(Boolean(data.stub));

        await ensureScript();
        if (cancelled) return;

        window.addEventListener("message", onMessage);
        if (typeof window.appendHelcimPayIframe !== "function") {
          throw new Error("HelcimPay.js loaded but appendHelcimPayIframe is unavailable");
        }
        window.appendHelcimPayIframe(data.checkoutToken);
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Could not open Helcim checkout");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
      try { window.removeHelcimPayIframe?.(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  if (error) {
    return (
      <div className="tactical-card p-4 border-destructive/40 bg-destructive/5 space-y-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-bold">Couldn't open checkout</div>
            <p className="text-muted-foreground text-xs mt-0.5">{error}</p>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={() => nav(-1)}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div id="helcim-pay-mount" className="rounded-md overflow-hidden min-h-[200px]">
      {loading && (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mb-2" />
          Opening secure payment…
        </div>
      )}
      {stub && !loading && (
        <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2 mt-3">
          Helcim is in <strong>setup mode</strong> (no API token yet). The modal will load but the
          payment itself won't process until a merchant account is connected.
        </div>
      )}
    </div>
  );
};
