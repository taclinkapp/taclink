import { useEffect, useState } from "react";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, ExternalLink, Loader2, ShieldCheck, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { HowPaymentsWorkCard } from "@/components/HowPaymentsWorkCard";
import { stripeEnvironment } from "@/lib/stripe";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useActivePaymentProvider } from "@/hooks/useActivePaymentProvider";

type ConnectStatus = "not_started" | "onboarding" | "active" | "restricted";

const STATUS_META: Record<ConnectStatus, { label: string; tone: string; description: string }> = {
  not_started: {
    label: "Required to publish",
    tone: "border-destructive/40 bg-destructive/5",
    description: "Connect a payout account to receive the full course price (paid 24h after each completed course). You cannot publish courses until this is set up.",
  },
  onboarding: {
    label: "Setup in progress",
    tone: "border-amber-500/40 bg-amber-500/5",
    description: "Finish onboarding with our payout processor — they need a few more details to enable payouts. Course publishing stays locked until this is complete.",
  },
  active: {
    label: "Payouts enabled",
    tone: "border-success/40 bg-success/5",
    description: "Full course price will be transferred to your payout account after each completed course. TacLink keeps only the $25 platform fee.",
  },
  restricted: {
    label: "Action required",
    tone: "border-destructive/40 bg-destructive/5",
    description: "Our payout processor needs additional information before payouts can resume.",
  },
};

type PayoutMethod = {
  id: string;
  method_type: 'cashapp' | 'venmo' | 'paypal' | 'zelle';
  handle: string;
  is_preferred: boolean;
};

const METHOD_LABEL: Record<PayoutMethod['method_type'], string> = {
  cashapp: 'Cash App',
  venmo: 'Venmo',
  paypal: 'PayPal',
  zelle: 'Zelle',
};

const PayoutMethods = () => {
  const { user } = useAuth();
  const { provider, loading: providerLoading } = useActivePaymentProvider();
  const [status, setStatus] = useState<ConnectStatus>("not_started");
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [methodType, setMethodType] = useState<PayoutMethod['method_type']>('zelle');
  const [handle, setHandle] = useState('');
  const [savingMethod, setSavingMethod] = useState(false);

  const reload = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    if (provider === 'helcim') {
      const [{ data: acct }, { data: pm }] = await Promise.all([
        supabase.from('instructor_payout_accounts').select('status').eq('instructor_id', user.id).eq('provider', 'helcim').maybeSingle(),
        supabase.from('instructor_payout_methods').select('id, method_type, handle, is_preferred').eq('instructor_id', user.id).order('is_preferred', { ascending: false }),
      ]);
      setStatus((acct?.status as ConnectStatus) ?? 'not_started');
      setMethods((pm as PayoutMethod[]) ?? []);
    } else {
      const { data, error } = await supabase
        .from('profiles')
        .select('stripe_connect_status')
        .eq('id', user.id)
        .maybeSingle();
      if (error) toast.error(error.message);
      setStatus((data?.stripe_connect_status as ConnectStatus) ?? 'not_started');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (providerLoading) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, provider, providerLoading]);

  const launchOnboarding = async () => {
    if (!user) return;
    setLaunching(true);
    try {
      const baseUrl = `${window.location.origin}/instructor/payout-methods`;
      const { data, error } = await supabase.functions.invoke('create-connect-onboarding', {
        body: { returnUrl: `${baseUrl}?stripe=return`, refreshUrl: `${baseUrl}?stripe=refresh`, environment: stripeEnvironment },
      });
      if (error || !data?.url) throw new Error(error?.message ?? 'Could not start payout onboarding');
      window.location.href = data.url;
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not start payout onboarding');
      setLaunching(false);
    }
  };

  const addHelcimMethod = async () => {
    if (!user) return;
    const trimmed = handle.trim();
    if (!trimmed) { toast.error('Enter your payout handle'); return; }
    setSavingMethod(true);
    try {
      const isFirst = methods.length === 0;
      const { error } = await supabase.from('instructor_payout_methods').insert({
        instructor_id: user.id,
        method_type: methodType,
        handle: trimmed,
        is_preferred: isFirst,
      });
      if (error) throw error;
      // Mark the Helcim payout account active so publishing unlocks.
      await supabase.from('instructor_payout_accounts').upsert({
        instructor_id: user.id,
        provider: 'helcim',
        status: 'active',
        payouts_enabled: true,
        charges_enabled: true,
      }, { onConflict: 'instructor_id,provider' });
      setHandle('');
      toast.success('Payout method added');
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not add payout method');
    } finally {
      setSavingMethod(false);
    }
  };

  const removeMethod = async (id: string) => {
    const { error } = await supabase.from('instructor_payout_methods').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Removed');
    await reload();
  };

  const setPreferred = async (id: string) => {
    if (!user) return;
    await supabase.from('instructor_payout_methods').update({ is_preferred: false }).eq('instructor_id', user.id);
    const { error } = await supabase.from('instructor_payout_methods').update({ is_preferred: true }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    await reload();
  };

  const meta = STATUS_META[status];

  return (
    <MobileShell>
      <PaymentTestModeBanner />
      <PageHeader title="Payout Method" back />

      <div className="px-4 py-4 space-y-4">
        <HowPaymentsWorkCard audience="instructor" />

        <div className={`tactical-card p-4 border ${meta.tone}`}>
          <div className="flex items-center gap-2 mb-1">
            {status === 'active' ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : status === 'restricted' ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-primary" />
            )}
            <div className="text-xs uppercase tracking-wider font-bold">{meta.label}</div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{meta.description}</p>
        </div>

        {loading || providerLoading ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading…
          </div>
        ) : provider === 'helcim' ? (
          <>
            <div className="tactical-card p-4 border-border space-y-3">
              <div className="text-xs uppercase tracking-wider font-bold">Add payout destination</div>
              <p className="text-[11px] text-muted-foreground">
                Helcim collects student payments. TacLink batches your weekly payout to the destination below.
              </p>
              <div className="space-y-2">
                <Label className="text-xs">Method</Label>
                <Select value={methodType} onValueChange={(v) => setMethodType(v as PayoutMethod['method_type'])}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zelle">Zelle</SelectItem>
                    <SelectItem value="cashapp">Cash App</SelectItem>
                    <SelectItem value="venmo">Venmo</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Handle / email / phone</Label>
                <Input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder={methodType === 'zelle' ? 'email or phone' : `$your-${methodType}`}
                  className="h-11"
                />
              </div>
              <Button onClick={addHelcimMethod} disabled={savingMethod} className="w-full h-11 bg-primary text-primary-foreground font-bold">
                {savingMethod ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add payout method'}
              </Button>
            </div>

            {methods.length > 0 && (
              <div className="tactical-card p-4 border-border space-y-2">
                <div className="text-xs uppercase tracking-wider font-bold mb-1">Your payout methods</div>
                {methods.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{METHOD_LABEL[m.method_type]} · {m.handle}</div>
                      {m.is_preferred && <div className="text-[10px] uppercase tracking-wider text-success font-bold">Preferred</div>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!m.is_preferred && (
                        <Button size="sm" variant="outline" onClick={() => setPreferred(m.id)} className="h-8 text-[11px]">
                          Make preferred
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => removeMethod(m.id)} className="h-8 w-8">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <Button onClick={launchOnboarding} disabled={launching} className="w-full h-12 bg-primary text-primary-foreground font-bold">
            {launching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
            {status === 'active' ? 'Manage payout account' : status === 'not_started' ? 'Connect payout account' : 'Continue payout setup'}
          </Button>
        )}

        <div className="tactical-card p-4 border-primary/20 bg-primary/5 text-[11px] text-muted-foreground leading-relaxed">
          Powered by Helcim — our PCI-compliant payment processor handles student charges, refunds, and instructor payouts.
        </div>
      </div>
    </MobileShell>
  );
};

export default PayoutMethods;
