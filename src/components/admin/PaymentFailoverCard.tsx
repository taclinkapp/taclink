import { useEffect, useState } from "react";
import { CreditCard, ShieldAlert, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Provider = "stripe" | "helcim";

type Settings = {
  active_provider: Provider;
  fallback_provider: Provider | null;
  failover_mode: "manual" | "auto" | "segment";
  helcim_configured: boolean;
  notes: string | null;
  updated_at: string;
};

const PROVIDER_LABEL: Record<Provider, string> = {
  stripe: "Stripe (backup rail)",
  helcim: "Helcim (2A-friendly, primary target)",
};

export function PaymentFailoverCard() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("payment_provider_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (error) toast.error("Failed to load failover settings");
    setSettings((data as Settings | null) ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const switchTo = async (provider: Provider) => {
    if (!settings) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any)
        .from("payment_provider_settings")
        .update({
          active_provider: provider,
          fallback_provider: provider === "stripe" ? "helcim" : "stripe",
          updated_at: new Date().toISOString(),
        })
        .eq("id", true);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`Active payment processor set to ${PROVIDER_LABEL[provider]}`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="tactical-card p-5">
        <div className="flex items-center gap-2 text-sm font-bold">
          <CreditCard className="h-4 w-4 text-primary" /> Payment Failover
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </section>
    );
  }

  if (!settings) return null;

  const active = settings.active_provider;
  const isStripeActive = active === "stripe";
  const targetProvider: Provider = isStripeActive ? "helcim" : "stripe";
  const canSwitchToHelcim = settings.helcim_configured;
  const switchDisabled = busy || (targetProvider === "helcim" && !canSwitchToHelcim);

  return (
    <section className="tactical-card p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-bold">
        <CreditCard className="h-4 w-4 text-primary" /> Payment Failover
      </div>

      <p className="text-xs text-muted-foreground">
        Helcim is the planned <strong>primary</strong> processor (2A-friendly,
        merchant account in underwriting). Stripe stays active as the backup
        rail until Helcim credentials are added and the adapter is marked
        configured. Switching flips all future checkouts and subscriptions;
        in-flight payments on the old rail finish on that rail.
      </p>

      {/* Status row */}
      <div className="rounded-lg border border-border bg-background/50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Active Processor</Label>
          <span className="inline-flex items-center gap-1.5 text-sm font-bold">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            {PROVIDER_LABEL[active]}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Helcim Configured</Label>
          {canSwitchToHelcim ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-green-500">
              <CheckCircle2 className="h-3 w-3" /> Helcim ready
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-500">
              <AlertTriangle className="h-3 w-3" /> Awaiting credentials
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Failover Mode</Label>
          <span className="text-xs font-mono uppercase">{settings.failover_mode}</span>
        </div>
      </div>

      {!canSwitchToHelcim && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-500">
            <ShieldAlert className="h-3.5 w-3.5" /> Phase 2 setup required
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Before this switch will work, complete the Helcim setup:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Finish Helcim merchant account application (firearms-friendly underwriting, ~1–2 weeks).</li>
            <li>Generate an API token in Helcim dashboard → Integrations → API Access (with HelcimPay scope).</li>
            <li>Add <code className="font-mono">HELCIM_API_TOKEN</code> and <code className="font-mono">HELCIM_WEBHOOK_VERIFIER_TOKEN</code> as backend secrets.</li>
            <li>Implement the <code className="font-mono">HelcimProvider</code> adapter (stub already wired) — HelcimPay.js modal for checkout, ledger-based weekly ACH for instructor payouts.</li>
            <li>Configure the Helcim webhook to point at <code className="font-mono">/functions/v1/helcim-webhook?env=live</code>.</li>
            <li>Flip <code className="font-mono">helcim_configured = true</code> in <code className="font-mono">payment_provider_settings</code>, then switch active processor here.</li>
          </ol>
        </div>
      )}

      {/* Switch action */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant={isStripeActive ? "destructive" : "default"}
            disabled={switchDisabled}
            className="w-full h-11 font-bold"
          >
            {busy ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Switching…</>
            ) : (
              <>Switch active processor → {PROVIDER_LABEL[targetProvider]}</>
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch payment processor?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                All <strong>new</strong> checkouts, refunds, payouts, and subscription
                signups will route through <strong>{PROVIDER_LABEL[targetProvider]}</strong>.
              </span>
              <span className="block">
                Existing {PROVIDER_LABEL[active]} subscriptions stay on {PROVIDER_LABEL[active]}
                until they renew or are migrated. Held escrow funds stay on the
                original rail until released.
              </span>
              <span className="block font-bold text-destructive">
                This is a platform-wide change. Only flip during an actual outage
                or deplatforming event.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => switchTo(targetProvider)}>
              Yes, switch to {PROVIDER_LABEL[targetProvider]}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="text-[10px] text-muted-foreground text-right">
        Last updated {new Date(settings.updated_at).toLocaleString()}
      </p>
    </section>
  );
}
