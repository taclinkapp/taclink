import { useState } from "react";
import {
  ChevronDown,
  CreditCard,
  HandCoins,
  Info,
  Smartphone,
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
 * How TacLink payments work — shown to students and instructors so the
 * direct-handoff model is never confusing.
 *
 *   1) Student pays the $25 platform fee to TacLink (card)
 *   2) Student sends the 10% deposit directly to the instructor
 *      (Cash App / Venmo / PayPal / Zelle)
 *   3) Instructor collects the remaining balance IN PERSON in whatever
 *      method they prefer (cash, card reader, their own app, etc.)
 *
 * TacLink never holds, routes, or takes a cut of the deposit or the in-person
 * balance.
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
            title: "Pay TacLink the $25 platform fee",
            body: "Charged to your card at checkout. This is the only money TacLink touches.",
          },
          {
            icon: Smartphone,
            title: "Send the 10% deposit straight to the instructor",
            body: "One-tap deep link to their Cash App, Venmo, PayPal, or Zelle. 100% goes to the instructor — TacLink takes nothing. You have 24 hours.",
          },
          {
            icon: HandCoins,
            title: "Pay the remaining balance in person",
            body: "The instructor collects the rest at the course using whatever method they prefer (cash, card reader, their own payment app). TacLink is not involved in this step.",
          },
        ]
      : [
          {
            icon: CreditCard,
            title: "TacLink collects a $25 platform fee from the student",
            body: "Charged to their card when they book. This covers your listing on TacLink.",
          },
          {
            icon: Smartphone,
            title: "Student sends the 10% deposit straight to you",
            body: "They use the Cash App / Venmo / PayPal / Zelle handle you set under Deposit Payouts. You receive 100% of it. Tap 'Confirm received' on the roster to lock the seat.",
          },
          {
            icon: HandCoins,
            title: "You collect the rest in person, your way",
            body: "Cash, card reader, your own payment app — whatever you prefer. TacLink does not process or hold the in-person balance.",
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
              ? "$25 platform fee → 10% deposit to instructor → balance in person"
              : "Student pays $25 to TacLink → 10% deposit comes to you → balance in person"}
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
                  TacLink is <strong className="text-foreground">not</strong>{" "}
                  the middleman for your instructor's payment. You're paying
                  them directly, just like you would a private coach. Bring the
                  balance ready in their preferred method.
                </>
              ) : (
                <>
                  You're in control of how you collect the in-person balance.
                  TacLink does <strong className="text-foreground">not</strong>{" "}
                  process payouts for it — set up your deposit handles under
                  Settings → Deposit Payouts so students can pay you directly.
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
