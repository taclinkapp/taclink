import { useEffect, useState } from "react";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ExternalLink, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { HowPaymentsWorkCard } from "@/components/HowPaymentsWorkCard";
import { stripeEnvironment } from "@/lib/stripe";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

type ConnectStatus = "not_started" | "onboarding" | "active" | "restricted";

const STATUS_META: Record<ConnectStatus, { label: string; tone: string; description: string }> = {
  not_started: {
    label: "Required to publish",
    tone: "border-destructive/40 bg-destructive/5",
    description: "Connect a Stripe payout account to receive the full course price (paid 24h after each completed course). You cannot publish courses until this is set up.",
  },
  onboarding: {
    label: "Setup in progress",
    tone: "border-amber-500/40 bg-amber-500/5",
    description: "Finish onboarding with Stripe — they need a few more details to enable payouts. Course publishing stays locked until this is complete.",
  },
  active: {
    label: "Payouts enabled",
    tone: "border-success/40 bg-success/5",
    description: "Full course price will be transferred to your bank account 24h after each completed course. TacLink keeps only the $25 platform fee.",
  },
  restricted: {
    label: "Action required",
    tone: "border-destructive/40 bg-destructive/5",
    description: "Stripe needs additional information before payouts can resume. Click below to fix.",
  },
};

const PayoutMethods = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<ConnectStatus>("not_started");
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);

  const reload = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("stripe_connect_status")
      .eq("id", user.id)
      .maybeSingle();
    if (error) toast.error(error.message);
    setStatus((data?.stripe_connect_status as ConnectStatus) ?? "not_started");
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const launchOnboarding = async () => {
    if (!user) return;
    setLaunching(true);
    try {
      const baseUrl = `${window.location.origin}/instructor/payout-methods`;
      const { data, error } = await supabase.functions.invoke(
        "create-connect-onboarding",
        {
          body: {
            returnUrl: `${baseUrl}?stripe=return`,
            refreshUrl: `${baseUrl}?stripe=refresh`,
            environment: stripeEnvironment,
          },
        },
      );
      if (error || !data?.url) throw new Error(error?.message ?? "Could not start Stripe onboarding");
      window.location.href = data.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start Stripe onboarding");
      setLaunching(false);
    }
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
            {status === "active" ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : status === "restricted" ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-primary" />
            )}
            <div className="text-xs uppercase tracking-wider font-bold">{meta.label}</div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{meta.description}</p>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading…
          </div>
        ) : (
          <Button
            onClick={launchOnboarding}
            disabled={launching}
            className="w-full h-12 bg-primary text-primary-foreground font-bold"
          >
            {launching ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            {status === "active"
              ? "Manage Stripe account"
              : status === "not_started"
                ? "Connect with Stripe"
                : "Continue Stripe setup"}
          </Button>
        )}

        <div className="tactical-card p-4 border-primary/20 bg-primary/5 text-[11px] text-muted-foreground leading-relaxed">
          Powered by Stripe Connect. Stripe handles identity verification and bank
          payouts so TacLink never stores your financial details.
        </div>
      </div>
    </MobileShell>
  );
};

export default PayoutMethods;
