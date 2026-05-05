import { useState } from "react";
import { Copy, Check, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HELCIM_SANDBOX_TEST_CARDS } from "@/lib/helcimPayment";

const isSandbox = () => {
  const env = (import.meta.env.VITE_HELCIM_ENV as string | undefined)?.toLowerCase();
  if (env === "live" || env === "production") return false;
  return true; // default to sandbox banner unless explicitly live
};

export function HelcimSandboxCardBanner({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const [copied, setCopied] = useState<string | null>(null);
  if (!isSandbox()) return null;

  const copy = async (val: string) => {
    await navigator.clipboard.writeText(val.replace(/\s/g, ""));
    setCopied(val);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="rounded-md border border-primary/40 bg-primary/10 text-primary text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 font-semibold"
      >
        <CreditCard className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Helcim Sandbox — test card details</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-[11px] leading-relaxed text-foreground/80">
            Use these exact Helcim sandbox values. Generic Stripe test cards like <span className="font-mono">5454545454545454</span> are declined by Helcim as <span className="font-mono">INVALID CARD</span>.
          </p>
          <div className="space-y-1.5">
            {HELCIM_SANDBOX_TEST_CARDS.map((c) => (
              <div key={c.number} className="flex items-center gap-2 bg-background/60 rounded px-2 py-1.5">
                <span className="font-mono w-20 text-[11px]">{c.brand}</span>
                <span className="font-mono flex-1 tracking-wider">{c.number}</span>
                <span className="font-mono text-[11px] text-muted-foreground">CVV {c.cvv}</span>
                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copy(c.number)}>
                  {copied === c.number ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            ))}
          </div>
          <ul className="list-disc pl-4 space-y-0.5 text-[11px] leading-relaxed">
            <li><strong>Expiry:</strong> <span className="font-mono">{HELCIM_SANDBOX_TEST_CARDS[0].expiry}</span></li>
            <li><strong>CVV:</strong> use the CVV shown for the selected card.</li>
            <li><strong>ZIP/Postal:</strong> any valid format (e.g. <span className="font-mono">90210</span>)</li>
            <li>Submit the secure Helcim window and leave it open until the checkout reports success; the webhook will then flip the booking to <strong>paid</strong>.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
