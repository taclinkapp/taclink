import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isBookingPaymentConfirmed } from "@/lib/helcimPayment";

type Status = "waiting" | "confirmed" | "failed";

interface Props {
  bookingId: string;
}

/**
 * Live status indicator that mirrors what the Helcim webhook has done to
 * the booking. Subscribes to realtime updates AND polls every 3s as a
 * fallback, so the user always sees the up-to-date payment state.
 */
export function PaymentStatusBanner({ bookingId }: Props) {
  const [status, setStatus] = useState<Status>("waiting");
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const evaluate = (row: any) => {
      if (!row) return;
      if (isBookingPaymentConfirmed(row)) {
        setStatus("confirmed");
        setDetail(null);
      } else if (
        row.status === "cancelled" ||
        row.deposit_status === "failed" ||
        row.escrow_status === "failed"
      ) {
        setStatus("failed");
        setDetail(row.release_error ?? null);
      } else {
        setStatus("waiting");
      }
    };

    const fetchOnce = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("escrow_status, deposit_status, status, release_error")
        .eq("id", bookingId)
        .maybeSingle();
      if (!cancelled) evaluate(data);
    };

    void fetchOnce();
    const interval = window.setInterval(fetchOnce, 3000);
    const channel = supabase
      .channel(`booking-status-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        (payload) => evaluate(payload.new),
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [bookingId]);

  // The "waiting for webhook" state is intentionally hidden — the
  // Checkout button + secure payment modal already communicate that
  // a charge is in flight. We only surface this banner once Helcim
  // confirms (success) or reports a failure.
  if (status === "waiting") return null;

  const styles =
    status === "confirmed"
      ? "border-success/40 bg-success/10 text-success"
      : "border-destructive/40 bg-destructive/10 text-destructive";

  const Icon = status === "confirmed" ? CheckCircle2 : AlertTriangle;
  const title = status === "confirmed" ? "Payment confirmed" : "Payment failed";
  const help =
    status === "confirmed"
      ? "Helcim webhook received. Your booking is paid and held in escrow."
      : detail ?? "The payment processor reported a failure. You can retry below.";

  return (
    <div className={`rounded-md border px-3 py-2 flex items-start gap-2 text-xs ${styles}`}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="font-bold">{title}</div>
        <div className="text-[11px] opacity-90 mt-0.5">{help}</div>
      </div>
    </div>
  );
}
