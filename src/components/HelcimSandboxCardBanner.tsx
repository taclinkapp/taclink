import { useState } from "react";
import { Copy, Check, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const isSandbox = () => {
  const env = (import.meta.env.VITE_HELCIM_ENV as string | undefined)?.toLowerCase();
  if (env === "live" || env === "production") return false;
  return true; // default to sandbox banner unless explicitly live
};

const TEST_CARDS = [
  { brand: "Visa", number: "4111 1111 1111 1111" },
  { brand: "Mastercard", number: "5454 5454 5454 5454" },
];

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
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs">
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
          <div className="space-y-1.5">
            {TEST_CARDS.map((c) => (
              <div key={c.number} className="flex items-center gap-2 bg-background/60 rounded px-2 py-1.5">
                <span className="font-mono w-20 text-[11px]">{c.brand}</span>
                <span className="font-mono flex-1 tracking-wider">{c.number}</span>
                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copy(c.number)}>
                  {copied === c.number ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            ))}
          </div>
          <ul className="list-disc pl-4 space-y-0.5 text-[11px] leading-relaxed">
            <li><strong>Expiry:</strong> any future date (e.g. <span className="font-mono">12/30</span>)</li>
            <li><strong>CVV:</strong> any 3 digits (e.g. <span className="font-mono">123</span>)</li>
            <li><strong>ZIP/Postal:</strong> any valid format (e.g. <span className="font-mono">90210</span>)</li>
            <li>Submit the form in the secure window — the webhook will flip the booking to <strong>paid</strong> automatically.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
