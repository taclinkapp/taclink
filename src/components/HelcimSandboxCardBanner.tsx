import { useState } from "react";
import { Copy, Check, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HELCIM_SANDBOX_TEST_PROFILE } from "@/lib/helcimPayment";

const isSandbox = () => {
  const env = (import.meta.env.VITE_HELCIM_ENV as string | undefined)?.toLowerCase();
  if (env === "live" || env === "production") return false;
  return true; // default to sandbox banner unless explicitly live
};

export function HelcimSandboxCardBanner({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const [copied, setCopied] = useState<string | null>(null);
  if (!isSandbox()) return null;

  const { card } = HELCIM_SANDBOX_TEST_PROFILE;

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
            Use this one Helcim developer-test profile. <strong>Diagnostic confirmed:</strong> the connected <span className="font-mono">HELCIM_API_TOKEN</span> is valid but bound to a <strong>production terminal</strong>, so Helcim test cards (5413 3300 8909 9130 etc.) will be rejected as <span className="font-mono">INVALID CARD</span>. Generate a token from a Helcim <em>developer test account</em> and update <span className="font-mono">HELCIM_API_TOKEN</span> in Lovable Cloud secrets to make sandbox payments succeed.
          </p>
          <div className="bg-background/60 rounded px-2 py-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono w-20 text-[11px]">{card.brand}</span>
              <span className="font-mono flex-1 tracking-wider">{card.number}</span>
              <span className="font-mono text-[11px] text-muted-foreground">CVV {card.cvv}</span>
              <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copy(card.number)}>
                {copied === card.number ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-foreground/80">
              <span><strong>Name:</strong> {HELCIM_SANDBOX_TEST_PROFILE.fullName}</span>
              <span><strong>Phone:</strong> <span className="font-mono">{HELCIM_SANDBOX_TEST_PROFILE.phone}</span></span>
              <span className="sm:col-span-2"><strong>Address:</strong> {HELCIM_SANDBOX_TEST_PROFILE.address}</span>
            </div>
          </div>
          <ul className="list-disc pl-4 space-y-0.5 text-[11px] leading-relaxed">
            <li><strong>Expiry:</strong> <span className="font-mono">{card.expiry}</span></li>
            <li><strong>CVV:</strong> <span className="font-mono">{card.cvv}</span></li>
            <li><strong>ZIP/Postal:</strong> <span className="font-mono">{HELCIM_SANDBOX_TEST_PROFILE.zip}</span></li>
            <li>Submit the secure Helcim window and leave it open until the checkout reports success; the webhook will then flip the booking to <strong>paid</strong>.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
