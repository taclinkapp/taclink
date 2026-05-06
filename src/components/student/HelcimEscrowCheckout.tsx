import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle, RotateCcw, Clock, X, CreditCard, Lock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { isBookingPaymentConfirmed } from "@/lib/helcimPayment";

interface Props {
  bookingId: string;
  returnUrl: string;
}

const HELCIM_PAY_SCRIPT = "https://secure.helcim.app/helcim-pay/services/start.js";
// If we don't see a SUCCESS / ABORTED postMessage within this window,
// treat the modal as stuck and let the user retry.
const POSTMESSAGE_TIMEOUT_MS = 5 * 60 * 1000;

declare global {
  interface Window {
    appendHelcimPayIframe?: (token: string) => void;
    removeHelcimPayIframe?: () => void;
  }
}

type Phase = "idle" | "loading" | "waiting" | "error" | "aborted";
type ErrorKind =
  | "init_failed"
  | "script_failed"
  | "modal_unavailable"
  | "timeout"
  | "user_aborted"
  | "payment_declined"
  | "unknown";

interface ErrorState { kind: ErrorKind; message: string; }

const ERROR_COPY: Record<ErrorKind, { title: string; help: string }> = {
  init_failed: { title: "Couldn't start secure payment", help: "Our payment processor refused the request. Tap retry — your booking is safe." },
  script_failed: { title: "Payment module didn't load", help: "We couldn't reach the secure payment service. Check your connection and tap retry." },
  modal_unavailable: { title: "Payment module is misconfigured", help: "The payment script loaded but the checkout entry point is missing. Tap retry." },
  timeout: { title: "Payment timed out", help: "We didn't hear back from the payment window. Your card was not charged. Tap retry." },
  user_aborted: { title: "Payment cancelled", help: "You dismissed the secure payment window. Your booking is still pending — tap retry when you're ready." },
  payment_declined: { title: "Payment declined", help: "The card was declined. Try a different card or update your saved payment method, then retry." },
  unknown: { title: "Something went wrong", help: "An unexpected error happened during checkout. Tap retry, or go back and try again." },
};

interface SavedCard {
  id: string;
  method_type: string;
  brand: string | null;
  last4: string | null;
  cardholder_name: string | null;
  handle: string | null;
}

export const HelcimEscrowCheckout = ({ bookingId, returnUrl }: Props) => {
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<ErrorState | null>(null);
  const [stub, setStub] = useState(false);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [pmLoading, setPmLoading] = useState(true);

  const messageHandlerRef = useRef<((e: MessageEvent) => void) | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const paymentMethodsPath = useMemo(() => {
    const ret = encodeURIComponent(`/student/checkout/${bookingId}`);
    return `/student/payment-methods?returnTo=${ret}`;
  }, [bookingId]);

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

  // Load saved cards on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setPmLoading(false); return; }
      const { data } = await supabase
        .from("payment_methods")
        .select("id, method_type, brand, last4, cardholder_name, handle")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setSavedCards((data as SavedCard[]) ?? []);
      setPmLoading(false);
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  const ensureScript = useCallback(
    (): Promise<void> =>
      new Promise((resolve, reject) => {
        if (window.appendHelcimPayIframe) return resolve();
        const existing = document.querySelector(`script[src="${HELCIM_PAY_SCRIPT}"]`) as HTMLScriptElement | null;
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

      try { await ensureScript(); }
      catch (e: any) { throw new Error(`script_failed:${e?.message ?? "could not load HelcimPay.js"}`); }

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
        }
        // HIDE intentionally ignored — Helcim fires it on success too.
      };
      messageHandlerRef.current = onMessage;
      window.addEventListener("message", onMessage);

      timeoutRef.current = window.setTimeout(() => {
        cleanup();
        setError({ kind: "timeout", message: `No response after ${POSTMESSAGE_TIMEOUT_MS / 60000} minutes` });
        setPhase("error");
      }, POSTMESSAGE_TIMEOUT_MS);

      window.appendHelcimPayIframe(data.checkoutToken);
      setPhase("waiting");
    } catch (e: any) {
      const raw = String(e?.message ?? e ?? "");
      const [kindRaw, ...rest] = raw.split(":");
      const known: ErrorKind[] = ["init_failed","script_failed","modal_unavailable","timeout","user_aborted","payment_declined"];
      const kind = (known as string[]).includes(kindRaw) ? (kindRaw as ErrorKind) : "unknown";
      setError({ kind, message: rest.join(":").trim() || raw });
      setPhase("error");
    }
  }, [bookingId, returnUrl, cleanup, ensureScript]);

  useEffect(() => () => cleanup(), [cleanup]);

  // Auto-open the Helcim checkout window as soon as the booking is created,
  // so students go straight from "Confirm Booking" into the payment iframe.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (pmLoading) return;
    if (phase !== "idle") return;
    autoStartedRef.current = true;
    void start();
  }, [pmLoading, phase, start]);

  // Webhook poll while a payment is in flight.
  useEffect(() => {
    if (phase !== "waiting" && phase !== "loading") return;
    let cancelled = false;
    const checkBooking = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("escrow_status, deposit_status, status")
        .eq("id", bookingId)
        .maybeSingle();
      if (cancelled || !data) return;
      if (isBookingPaymentConfirmed(data)) {
        cleanup();
        window.location.href = returnUrl;
      }
    };
    const interval = window.setInterval(checkBooking, 3000);
    void checkBooking();
    const channel = supabase
      .channel(`booking-${bookingId}-payment`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        () => { void checkBooking(); })
      .subscribe();
    return () => { cancelled = true; window.clearInterval(interval); supabase.removeChannel(channel); };
  }, [bookingId, phase, returnUrl, cleanup]);

  const cards = savedCards.filter((c) => c.method_type === "card" && c.last4);
  const primaryCard = cards[0] ?? null;

  // Error / aborted screen
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
            {e.message && <p className="text-[11px] text-muted-foreground/80 mt-2 font-mono break-all">{e.message}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={start} className="flex-1">
            <RotateCcw className="h-4 w-4 mr-2" />Retry payment
          </Button>
          <Button variant="outline" onClick={() => nav(-1)}>Go back</Button>
        </div>
      </div>
    );
  }

  // Modal is open / waiting on webhook — Helcim renders its own full-screen
  // iframe via appendHelcimPayIframe, so we render nothing behind it.
  if (phase === "loading" || phase === "waiting") {
    return <div id="helcim-pay-mount" className="hidden" />;
  }

  // idle — show saved card + Pay button (mirrors instructor pre-publish UX)
  return (
    <div className="space-y-3">
      {pmLoading ? (
        <div className="tactical-card p-4 text-center text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" /> Loading your saved cards…
        </div>
      ) : primaryCard ? (
        <div className="tactical-card border-success/40 bg-success/10 p-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-12 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">
                {primaryCard.brand || "Card"} •••• {primaryCard.last4}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {primaryCard.cardholder_name || "Saved payment method"}
                {cards.length > 1 ? ` · ${cards.length - 1} more on file` : ""}
              </div>
            </div>
            <Link
              to={paymentMethodsPath}
              className="text-[11px] text-primary underline inline-flex items-center gap-1 shrink-0"
            >
              <Pencil className="h-3 w-3" /> Edit
            </Link>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            For your security, you'll re-enter your card details in the PCI-compliant payment window — your saved card is shown here for reference and is also used as the refund destination.
          </p>
        </div>
      ) : (
        <div className="tactical-card border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <CreditCard className="h-4 w-4 text-primary shrink-0" />
            <span className="text-foreground">No saved payment method.</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            You can still pay below — we recommend saving a card so refunds (instructor cancellations, no-shows) go back to a known destination automatically.
          </p>
          <Link to={paymentMethodsPath} className="text-[11px] text-primary underline inline-block">
            Add a payment method →
          </Link>
        </div>
      )}

      <Button
        onClick={start}
        disabled={pmLoading}
        className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
      >
        <Lock className="h-4 w-4 mr-2" />
        Checkout securely
      </Button>
      <p className="text-[10px] text-muted-foreground text-center">
        Opens a PCI-compliant payment window. Your card never touches our servers.
      </p>
    </div>
  );
};
