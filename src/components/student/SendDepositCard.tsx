import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  DollarSign,
  ExternalLink,
  Loader2,
  Mail,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { fmt } from "@/lib/fees";
import {
  PAYOUT_META,
  type DepositStatus,
  type PayoutHandle,
  type PayoutMethod,
} from "@/lib/payouts";
import { cn } from "@/lib/utils";

const ICON: Record<PayoutMethod, typeof Smartphone> = {
  cashapp: DollarSign,
  venmo: Smartphone,
  paypal: Mail,
  zelle: Mail,
};

type Props = {
  bookingId: string;
  instructorId: string;
  courseTitle: string;
  depositCents: number;
  depositStatus: DepositStatus;
  expiresAt: string | null;
  onChanged: () => void;
};

const useCountdown = (target: string | null) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  const ms = new Date(target).getTime() - now;
  if (ms <= 0) return { expired: true, label: "expired" };
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return {
    expired: false,
    label:
      h > 0 ? `${h}h ${m}m left` : m > 0 ? `${m}m ${s}s left` : `${s}s left`,
  };
};

export const SendDepositCard = ({
  bookingId,
  instructorId,
  courseTitle,
  depositCents,
  depositStatus,
  expiresAt,
  onChanged,
}: Props) => {
  const [handles, setHandles] = useState<PayoutHandle[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<PayoutMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const countdown = useCountdown(expiresAt);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("instructor_payout_methods")
        .select("id, instructor_id, method_type, handle, is_preferred, created_at")
        .eq("instructor_id", instructorId)
        .order("is_preferred", { ascending: false })
        .order("created_at", { ascending: true });
      if (!cancel) {
        const list = (data as PayoutHandle[]) ?? [];
        setHandles(list);
        const preferred = list.find((h) => h.is_preferred) ?? list[0];
        setPicked(preferred?.method_type ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [instructorId]);

  const note = useMemo(
    () => `TacLink deposit — ${courseTitle.slice(0, 40)}`,
    [courseTitle],
  );

  const pickedHandle = useMemo(
    () => handles?.find((h) => h.method_type === picked) ?? null,
    [handles, picked],
  );

  const markSent = async () => {
    if (!pickedHandle) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("bookings")
      .update({
        deposit_status: "awaiting_confirmation",
        deposit_method: pickedHandle.method_type,
        deposit_handle_used: pickedHandle.handle,
        deposit_sent_at: new Date().toISOString(),
      })
      .eq("id", bookingId);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Marked as sent — instructor will confirm receipt.");
    onChanged();
  };

  if (loading) {
    return (
      <div className="tactical-card p-4 text-center text-muted-foreground text-xs">
        <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" /> Loading deposit details…
      </div>
    );
  }

  if (depositStatus === "expired" || countdown?.expired) {
    return (
      <div className="tactical-card p-4 border-destructive/40 bg-destructive/5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-destructive">Deposit window expired.</strong> The 24-hour window to send your {fmt(depositCents)} deposit has passed. The booking has been released. Contact the instructor if you'd still like to attend.
          </div>
        </div>
      </div>
    );
  }

  if (depositStatus === "awaiting_confirmation") {
    return (
      <div className="tactical-card p-4 border-amber-500/40 bg-amber-500/5 space-y-3">
        <div className="flex items-start gap-2">
          <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed flex-1">
            <strong className="text-foreground">Waiting on instructor confirmation.</strong> You marked the {fmt(depositCents)} deposit as sent. Your seat is held — you'll be fully confirmed once the instructor verifies receipt.
          </div>
        </div>
        <Button
          disabled
          variant="outline"
          className="w-full h-10 text-xs font-bold opacity-70 cursor-not-allowed"
        >
          <Check className="h-3.5 w-3.5 mr-1.5" />
          You marked this paid · awaiting instructor
        </Button>
      </div>
    );
  }

  if (depositStatus === "confirmed") {
    return (
      <div className="tactical-card p-4 border-emerald-500/40 bg-emerald-500/5 space-y-3">
        <div className="flex items-start gap-2">
          <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-emerald-600">Deposit confirmed.</strong> Your seat is locked in. The remaining balance is due in person at the course.
          </div>
        </div>
        <Button
          disabled
          variant="outline"
          className="w-full h-10 text-xs font-bold opacity-70 cursor-not-allowed border-emerald-500/40 text-emerald-600"
        >
          <Check className="h-3.5 w-3.5 mr-1.5" />
          Deposit received · locked in
        </Button>
      </div>
    );
  }

  // pending_send
  if (!handles || handles.length === 0) {
    return (
      <div className="tactical-card p-4 border-amber-500/40 bg-amber-500/5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Instructor hasn't set up payouts yet.</strong> Message them to ask where to send the {fmt(depositCents)} deposit, then come back here and tap "I sent it" once paid.
          </div>
        </div>
        <Button
          variant="outline"
          onClick={markSent}
          disabled={submitting}
          className="w-full mt-3 h-10 text-xs font-bold"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
          I paid the instructor directly
        </Button>
      </div>
    );
  }

  return (
    <div className="tactical-card p-4 space-y-3 border-primary/40 bg-primary/5">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-primary font-bold flex items-center gap-2">
          <DollarSign className="h-3 w-3" /> Send Deposit Directly to Instructor
          {countdown && (
            <span className="ml-auto inline-flex items-center gap-1 text-amber-600 normal-case tracking-normal font-mono">
              <Clock className="h-3 w-3" /> {countdown.label}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <div className="text-3xl font-black text-primary">{fmt(depositCents)}</div>
          <div className="text-xs text-muted-foreground">goes 100% to the instructor</div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
          TacLink doesn't take a cut of this deposit. Send it via the method below, then tap "I sent it" — the instructor will confirm receipt to lock in your seat. <strong className="text-foreground">You have 24 hours.</strong>
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {handles.map((h) => {
          const meta = PAYOUT_META[h.method_type];
          const Icon = ICON[h.method_type];
          const active = picked === h.method_type;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => setPicked(h.method_type)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 h-9 rounded-full border text-[11px] font-bold uppercase tracking-wider transition",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              <Icon className="h-3 w-3" />
              {meta.label}
            </button>
          );
        })}
      </div>

      {pickedHandle && (
        <PickedHandlePanel
          handle={pickedHandle}
          amountCents={depositCents}
          note={note}
        />
      )}

      <Button
        onClick={markSent}
        disabled={submitting || !pickedHandle}
        className="w-full h-12 bg-primary text-primary-foreground font-bold"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
        I sent {fmt(depositCents)} to the instructor
      </Button>
      <p className="text-[10px] text-muted-foreground text-center italic">
        Marking falsely sent counts as a strike against your account.
      </p>
    </div>
  );
};

const PickedHandlePanel = ({
  handle,
  amountCents,
  note,
  depositStatus,
}: {
  handle: PayoutHandle;
  amountCents: number;
  note: string;
  depositStatus: DepositStatus;
}) => {
  const meta = PAYOUT_META[handle.method_type];
  const display = meta.normalizeForDisplay(handle.handle);
  const link = meta.deepLink(handle.handle, amountCents, note);
  const locked = depositStatus !== "pending_send";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(display);
      toast.success(`${meta.label} handle copied`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  // Guard against double-pay: if the deposit has already been marked sent /
  // confirmed / expired, intercept the deep link click before the payment app
  // opens so the student can't submit again.
  const guard = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (locked) {
      e.preventDefault();
      const msg =
        depositStatus === "awaiting_confirmation"
          ? "You already marked this deposit as sent. Wait for the instructor to confirm."
          : depositStatus === "confirmed"
            ? "Deposit already confirmed — no further payment needed."
            : "This deposit window has expired.";
      toast.error(msg);
    }
  };

  return (
    <div className="rounded-md border border-border bg-background p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {meta.label} handle
          </div>
          <div className="text-base font-mono font-bold truncate">{display}</div>
        </div>
        <button
          onClick={copy}
          className="p-2 rounded-md border border-border text-muted-foreground hover:text-primary hover:border-primary/50"
          aria-label="Copy handle"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      {link ? (
        <a
          href={locked ? undefined : link}
          onClick={guard}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={locked}
          className={cn(
            "w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-md border text-xs font-bold uppercase tracking-wider",
            locked
              ? "border-border bg-muted text-muted-foreground cursor-not-allowed"
              : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {locked ? "Payment locked" : `Open ${meta.label} with amount prefilled`}
        </a>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {handle.method_type === "zelle"
            ? "Open your bank's app, send via Zelle to the handle above."
            : "Open PayPal manually and send to the email above."}
        </p>
      )}
      <p className="text-[10px] text-muted-foreground">
        Add note: <span className="font-mono text-foreground">{note}</span>
      </p>
    </div>
  );
};
