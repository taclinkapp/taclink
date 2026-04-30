import { useState } from "react";
import {
  ChevronDown,
  CreditCard,
  HandCoins,
  Info,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Audience = "student" | "instructor";

interface Props {
  audience: Audience;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * How TacLink payments work — escrow model.
 *
 *   1) Student pays TacLink: $25 platform fee + 10% deposit at checkout
 *   2) TacLink holds the 10% in escrow until the instructor confirms
 *      attendance via QR scan at the course
 *   3) 24 hours after the course ends, the 10% is released to the instructor
 *   4) Cancellations: instructor cancels → student refunded fully within 48h.
 *      Student cancels after the 48h grace period → 10% goes to the instructor.
 *   5) Student pays the remaining balance to the instructor in person.
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
            title: "Pay $25 + 10% deposit at checkout",
            body: "Charged to your card. TacLink holds the 10% safely in escrow — the instructor doesn't get it yet.",
          },
          {
            icon: ShieldCheck,
            title: "Get scanned in at the course",
            body: "The instructor scans your QR code on arrival. That's the trigger that releases your deposit to them 24 hours after the course ends.",
          },
          {
            icon: HandCoins,
            title: "Pay the remaining balance in person",
            body: "Settle the rest with the instructor at the course in their preferred method (cash, card reader, their own app).",
          },
        ]
      : [
          {
            icon: CreditCard,
            title: "TacLink collects $25 + 10% deposit from the student",
            body: "Held in escrow at checkout. The 10% is yours once you confirm the student attended.",
          },
          {
            icon: ShieldCheck,
            title: "Scan the student's QR code in person",
            body: "Scan = proof of attendance. Funds auto-release to your payout method 24 hours after the course ends. Forgot to scan? File an attendance claim from the roster.",
          },
          {
            icon: HandCoins,
            title: "Collect the balance in person, your way",
            body: "Cash, card reader, your own app — whatever you prefer. TacLink only handles the 10% deposit.",
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
              ? "$25 + 10% deposit held in escrow → released after attendance"
              : "Student pays $25 + 10% to TacLink → released to you 24h after attendance"}
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
                  Cancellations: if the instructor cancels or no-shows, you're
                  refunded the full $25 + 10% within 48 hours. If you cancel
                  after the 48-hour grace period, the 10% deposit goes to the
                  instructor.
                </>
              ) : (
                <>
                  Cancellations: if you cancel or no-show, the student is
                  refunded the full $25 + 10% within 48 hours. If the student
                  cancels after the 48-hour grace period, the 10% deposit is
                  released to you.
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
