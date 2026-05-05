import { useState } from "react";
import {
  ChevronDown,
  CreditCard,
  Info,
  ShieldCheck,
  Wallet,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTransferFeePct } from "@/lib/fees";

type Audience = "student" | "instructor";

interface Props {
  audience: Audience;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * How TacLink payments work — FULL ONLINE model.
 *
 *   1) Student pays TacLink the full course price + $25 platform fee at checkout.
 *      Nothing is paid in person.
 *   2) TacLink holds the full course price in escrow until the instructor
 *      confirms attendance via QR scan at the course.
 *   3) 24 hours after the course ends, the full course price is transferred
 *      to the instructor's connected payout account.
 *   4) Refunds: instructor cancels/no-shows → student gets 100% back within 48h.
 *      Student cancels within grace window → 100% back. Late student cancel →
 *      90% back to student, 10% to instructor for the lost slot.
 */
export const HowPaymentsWorkCard = ({
  audience,
  defaultOpen = false,
  className,
}: Props) => {
  const [open, setOpen] = useState(defaultOpen);

  const steps =
    audience === "student"
      ? [
          {
            icon: CreditCard,
            title: "Pay the full course price + $25 at checkout",
            body: "Charged once to your card. Nothing else due — no cash, no card reader at the range, no surprise fees.",
          },
          {
            icon: ShieldCheck,
            title: "Get scanned in at the course",
            body: "The instructor scans your QR code on arrival. That's the proof of attendance that releases payment to them after the course.",
          },
          {
            icon: Banknote,
            title: "Instructor is paid 24h after course ends",
            body: "TacLink holds the funds in secure escrow until the course is complete, then transfers the full course price to the instructor automatically.",
          },
        ]
      : [
          {
            icon: CreditCard,
            title: "TacLink collects the full course price + $25 from the student",
            body: "Held safely in escrow at booking. You don't handle any cash, cards, or invoices on course day.",
          },
          {
            icon: ShieldCheck,
            title: "Scan the student's QR code at the course",
            body: "Scan = proof of attendance. Forgot to scan? File an attendance claim from the roster.",
          },
          {
            icon: Banknote,
            title: `Course price paid out 24h after course ends (minus ${formatTransferFeePct()} transfer fee)`,
            body: `Transferred straight to your connected payout account. TacLink keeps the $25 platform fee and the payout processor charges a flat ${formatTransferFeePct()} transfer fee on the course price — you keep the rest.`,
          },
        ];

  return (
    <div
      className={cn(
        "tactical-card border-primary/30 bg-primary/5 overflow-hidden",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="h-9 w-9 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
          <Info className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-primary font-bold">
            How TacLink™ Payments Work
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {audience === "student"
              ? "Pay full price online → released to instructor after attendance"
              : "Student pays full price online → paid to you 24h after course"}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform shrink-0",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-primary/20">
          <ol className="space-y-3 mt-3">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={i} className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className="h-9 w-9 rounded-md bg-background border border-border flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="absolute -top-1 -left-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {i + 1}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-foreground leading-tight">
                      {s.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      {s.body}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="rounded-md border border-border bg-background/60 p-3 flex items-start gap-2">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {audience === "student" ? (
                <>
                  Cancellations: instructor cancels or no-shows → 100% refund within 48 hours.
                  You cancel within your grace window → 100% refund. Late cancel → 90% of the
                  course price refunded; instructor keeps 10% for the lost slot.
                </>
              ) : (
                <>
                  Cancellations: you cancel or no-show → student is fully refunded ($25 + 100%
                  course price). Student cancels within grace window → fully refunded. Late
                  student cancel → you keep 10% of the course price as compensation.
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
