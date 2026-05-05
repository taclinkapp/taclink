import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle, RotateCcw, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { isBookingPaymentConfirmed } from "@/lib/helcimPayment";

interface Props {
  bookingId: string;
  returnUrl: string;
}

const HELCIM_PAY_SCRIPT = "https://secure.helcim.app/helcim-pay/services/start.js";
// If we don't see a SUCCESS / ABORTED / HIDE postMessage within this
// window, treat the modal as stuck and let the user retry.
const POSTMESSAGE_TIMEOUT_MS = 5 * 60 * 1000;

declare global {
  interface Window {
    appendHelcimPayIframe?: (token: string) => void;
    removeHelcimPayIframe?: () => void;
  }
}

type Phase = "loading" | "ready" | "waiting" | "error" | "aborted";
type ErrorKind =
  | "init_failed"        // create-helcim-checkout returned an error
  | "script_failed"      // HelcimPay.js failed to load
  | "modal_unavailable"  // script loaded but global hook missing
  | "timeout"            // user didn't complete the modal in time
  | "user_aborted"       // user dismissed the modal
  | "payment_declined"   // processor declined the attempted card/bank payment
  | "unknown";

interface ErrorState {
  kind: ErrorKind;
  message: string;
}

const ERROR_COPY: Record<ErrorKind, { title: string; help: string }> = {
  init_failed: {
    title: "Couldn't start secure payment",
    help: "Our payment processor refused the request. Tap retry — if it keeps failing, your booking is safe and you can try again later.",
  },
  script_failed: {
    title: "Payment module didn't load",
    help: "We couldn't reach the secure payment service. Check your connection and tap retry.",
  },
  modal_unavailable: {
    title: "Payment module is misconfigured",
    help: "The payment script loaded but the checkout entry point is missing. Tap retry to reload it.",
  },
  timeout: {
    title: "Payment timed out",
    help: "We didn't hear back from the payment window. Your card was not charged. Tap retry to reopen it.",
  },
  user_aborted: {
    title: "Payment cancelled",
    help: "You dismissed the secure payment window. Your booking is still pending — tap retry when you're ready to pay.",
  },
  payment_declined: {
    title: "Payment declined",
    help: "The payment processor declined that attempt. In Helcim sandbox, use the exact test card, expiry, and CVV shown above — generic test cards like 5454545454545454 are declined.",
  },
  unknown: {
    title: "Something went wrong",
    help: "An unexpected error happened during checkout. Tap retry, or go back and try again from your booking.",
  },
};

/**
 * HelcimPay.js modal wrapper for the TacLink escrow charge.
 *
 * Surfaces specific errors (init failed, script failed, postMessage
 * timeout, user-cancelled) and offers an in-place retry so the student
 * doesn't have to navigate away.
 */
export const HelcimEscrowCheckout = ({ bookingId, returnUrl }: Props) => {
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<ErrorState | null>(null);
  const [stub, setStub] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const messageHandlerRef = useRef<((e: MessageEvent) => void) | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (messageHandlerRef.current) {
      window.removeEventListener("message", messageHandlerRef.current);
      messageHandlerRef.current = null;
    }
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    try { window.removeHelcimPayIframe?.(); } catch { /* noop */ }
  }, []);

  const ensureScript = useCallback(
    (): Promise<void> =>
      new Promise((resolve, reject) => {
        if (window.appendHelcimPayIframe) return resolve();
        const existing = document.querySelector(
          `script[src="${HELCIM_PAY_SCRIPT}"]`,
        ) as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("script_failed")));
          return;
        }
        const s = document.createElement("script");
        s.src = HELCIM_PAY_SCRIPT;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("script_failed"));
        document.head.appendChild(s);
      }),
    [],
  );

  const start = useCallback(async () => {
    cleanup();
    setError(null);
    setPhase("loading");

    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        "create-helcim-checkout",
        { body: { bookingId, returnUrl } },
      );
      if (invokeErr || !data?.checkoutToken) {
        throw new Error(`init_failed:${invokeErr?.message ?? "no checkoutToken in response"}`);
      }
      setStub(Boolean(data.stub));

      try {
        await ensureScript();
      } catch (e: any) {
        throw new Error(`script_failed:${e?.message ?? "could not load HelcimPay.js"}`);
      }

      if (typeof window.appendHelcimPayIframe !== "function") {
        throw new Error("modal_unavailable:appendHelcimPayIframe is undefined");
      }

      const checkoutToken = String(data.checkoutToken);
      const onMessage = async (event: MessageEvent) => {
        const payload = event.data;
        if (!payload || typeof payload !== "object") return;
        if (payload.eventName !== `helcim-pay-js-${checkoutToken}`) return;
        const status = payload.eventStatus ?? payload.status;
        if (status === "SUCCESS") {
          cleanup();
          setPhase("loading");
          const { error: confirmErr } = await supabase.functions.invoke(
            "confirm-helcim-payment",
            { body: { bookingId, checkoutToken, eventMessage: payload.eventMessage } },
          );
          if (confirmErr) {
            setError({ kind: "init_failed", message: confirmErr.message });
            setPhase("error");
            return;
          }
          window.location.href = returnUrl;
        } else if (status === "ABORTED") {
          cleanup();
          setError({ kind: "payment_declined", message: String(payload.eventMessage ?? "Payment attempt was declined") });
          setPhase("error");
        } else if (status === "HIDE") {
          // HIDE alone (without SUCCESS) typically means the user closed
          // the modal manually — Helcim emits ABORTED for that, but if we
          // only see HIDE we treat it as an abort too.
          cleanup();
          setError({ kind: "user_aborted", message: "Payment window was closed" });
          setPhase("aborted");
        }
      };
      messageHandlerRef.current = onMessage;
      window.addEventListener("message", onMessage);

      // Timeout watchdog — if no terminal event arrives, surface a retry.
      timeoutRef.current = window.setTimeout(() => {
        cleanup();
        setError({
          kind: "timeout",
          message: `No response from the payment window after ${POSTMESSAGE_TIMEOUT_MS / 60000} minutes`,
        });
        setPhase("error");
      }, POSTMESSAGE_TIMEOUT_MS);

      window.appendHelcimPayIframe(data.checkoutToken);
      setPhase("waiting");
    } catch (e: any) {
      const raw = String(e?.message ?? e ?? "");
      const [kindRaw, ...rest] = raw.split(":");
      const known: ErrorKind[] = [
        "init_failed",
        "script_failed",
        "modal_unavailable",
        "timeout",
        "user_aborted",
        "payment_declined",
      ];
      const kind = (known as string[]).includes(kindRaw) ? (kindRaw as ErrorKind) : "unknown";
      setError({ kind, message: rest.join(":").trim() || raw });
      setPhase("error");
    }
  }, [bookingId, returnUrl, cleanup, ensureScript]);

  useEffect(() => {
    start();
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, attempt]);

  // Poll + realtime-subscribe for the webhook-driven escrow flip while the
  // payment modal is open. As soon as the Helcim webhook marks the booking
  // as held_in_escrow we redirect, even if the postMessage SUCCESS event
  // never reaches us (popup blockers, cross-origin quirks, etc.).
  useEffect(() => {
    if (phase !== "waiting" && phase !== "loading") return;
    let cancelled = false;

    const checkBooking = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("escrow_status, deposit_status, status")
        .eq("id", bookingId)
        .maybeSingle();
      if (cancelled || !data) return false;
      if (isBookingPaymentConfirmed(data)) {
        cleanup();
        window.location.href = returnUrl;
        return true;
      }
      return false;
    };

    const interval = window.setInterval(checkBooking, 3000);
    void checkBooking();

    const channel = supabase
      .channel(`booking-${bookingId}-payment`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        () => { void checkBooking(); },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [bookingId, phase, returnUrl, cleanup]);

  const retry = () => setAttempt((n) => n + 1);

  if (phase === "error" || phase === "aborted") {
    const e = error ?? { kind: "unknown" as ErrorKind, message: "" };
    const copy = ERROR_COPY[e.kind];
    const Icon = e.kind === "user_aborted" ? X : e.kind === "timeout" ? Clock : AlertTriangle;
    return (
      <div className="tactical-card p-4 border-destructive/40 bg-destructive/5 space-y-3">
        <div className="flex items-start gap-2">
          <Icon className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <div className="font-bold">{copy.title}</div>
            <p className="text-muted-foreground text-xs mt-0.5">{copy.help}</p>
            {e.message && (
              <p className="text-[11px] text-muted-foreground/80 mt-2 font-mono break-all">
                {e.message}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={retry} className="flex-1">
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry payment
          </Button>
          <Button variant="outline" onClick={() => nav(-1)}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div id="helcim-pay-mount" className="rounded-md overflow-hidden min-h-[200px]">
      {phase === "loading" && (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mb-2" />
          Opening secure payment…
        </div>
      )}
      {phase === "waiting" && (
        <div className="text-xs text-muted-foreground text-center py-2">
          Complete payment in the secure window above. We'll redirect you when it's done.
        </div>
      )}
      {stub && phase !== "loading" && (
        <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2 mt-3">
          Helcim is in <strong>setup mode</strong> (no API token yet). The modal will load but the
          payment itself won't process until a merchant account is connected.
        </div>
      )}
    </div>
  );
};
