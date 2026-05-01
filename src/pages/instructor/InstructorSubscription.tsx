import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, Crown, Sparkles, ExternalLink, AlertTriangle, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fmt, INSTRUCTOR_SUBSCRIPTION_CENTS } from '@/lib/fees';
import { usePrelaunch } from '@/hooks/usePrelaunch';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionEmbeddedCheckout } from '@/components/SubscriptionEmbeddedCheckout';
import { getStripeEnvironment } from '@/lib/stripe';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PRICE_ID = 'instructor_pro_monthly';

const InstructorSubscription = () => {
  const { user } = useAuth();
  const { data: prelaunch, isLoading: prelaunchLoading } = usePrelaunch();
  const { subscription, isActive, isCanceledGrace, isPastDue, loading: subLoading, refetch } = useSubscription();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);

  if (prelaunchLoading || subLoading) {
    return (
      <MobileShell withTabBar={false}>
        <PageHeader title="Subscription" back />
        <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      </MobileShell>
    );
  }
  if (prelaunch?.enabled) return <Navigate to="/instructor" replace />;

  const openPortal = async () => {
    setPortalBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/instructor/subscription`,
        },
      });
      if (error || !data?.url) throw new Error(error?.message || data?.error || 'Could not open billing portal');
      window.open(data.url, '_blank');
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not open billing portal');
    } finally {
      setPortalBusy(false);
    }
  };

  const periodEndStr = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="Subscription" back />
      <div className="px-4 py-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Pro unlocks AI tools and instructor analytics. Publishing courses is always free.
        </p>

        {isPastDue && (
          <div className="tactical-card border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-bold text-amber-700 dark:text-amber-400">Payment failed</div>
              <p className="text-muted-foreground mt-0.5">Stripe is retrying your payment. Update your card to keep Pro features.</p>
            </div>
          </div>
        )}

        {isCanceledGrace && periodEndStr && (
          <div className="tactical-card border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <div className="font-bold">Subscription ending</div>
            <p className="text-muted-foreground mt-0.5">You'll keep Pro access until {periodEndStr}, then drop to Free.</p>
          </div>
        )}

        {/* Free tier */}
        <div className={cn(
          "tactical-card p-5 space-y-3 transition-all",
          !isActive ? "border-primary/60 bg-primary/5" : "border-border opacity-80"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <div className="text-lg font-black">Free</div>
                <div className="text-xs text-muted-foreground">$0 / month</div>
              </div>
            </div>
            {!isActive && (
              <span className="text-[10px] uppercase tracking-wider font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-sm">Current</span>
            )}
          </div>
          <ul className="text-xs text-muted-foreground space-y-1.5 pl-1">
            <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> Publish unlimited courses</li>
            <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> Roster, attendance & check-in tools</li>
            <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> 10% listing fee per course</li>
            <li className="flex gap-2 text-muted-foreground/60"><span className="h-3.5 w-3.5 shrink-0 mt-0.5">—</span> No AI course tools</li>
            <li className="flex gap-2 text-muted-foreground/60"><span className="h-3.5 w-3.5 shrink-0 mt-0.5">—</span> No fee insights or analytics</li>
          </ul>
        </div>

        {/* Pro tier */}
        <div className={cn(
          "tactical-card p-5 space-y-3 transition-all",
          isActive ? "border-primary/60 bg-primary/10" : "border-primary/30"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center">
                <Crown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-lg font-black">Pro</div>
                <div className="text-xs text-muted-foreground">{fmt(INSTRUCTOR_SUBSCRIPTION_CENTS)} / month</div>
              </div>
            </div>
            {isActive && (
              <span className="text-[10px] uppercase tracking-wider font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-sm">Current</span>
            )}
          </div>
          <ul className="text-xs text-muted-foreground space-y-1.5 pl-1">
            <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> Everything in Free</li>
            <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> <strong className="text-foreground">AI course builder:</strong> auto-suggest titles, descriptions, waivers</li>
            <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> AI-powered fee insights & payout summaries</li>
            <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> Local demand & instructor analytics</li>
          </ul>

          {!isActive ? (
            <Button
              onClick={() => setCheckoutOpen(true)}
              className="w-full h-11 bg-primary text-primary-foreground font-bold"
            >
              Upgrade to Pro · {fmt(INSTRUCTOR_SUBSCRIPTION_CENTS)}/mo
            </Button>
          ) : (
            <Button
              onClick={openPortal}
              disabled={portalBusy}
              variant="outline"
              className="w-full h-11 font-bold"
            >
              {portalBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ExternalLink className="h-4 w-4 mr-1.5" />Manage subscription</>}
            </Button>
          )}
        </div>

        {isActive && periodEndStr && (
          <p className="text-[10px] text-muted-foreground text-center">
            {isCanceledGrace ? 'Access ends' : 'Renews'} {periodEndStr}
          </p>
        )}
      </div>

      <Dialog open={checkoutOpen} onOpenChange={(v) => { setCheckoutOpen(v); if (!v) refetch(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Upgrade to Pro</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {checkoutOpen && user && (
              <SubscriptionEmbeddedCheckout
                priceId={PRICE_ID}
                customerEmail={user.email ?? undefined}
                userId={user.id}
                returnUrl={`${window.location.origin}/instructor/subscription?upgraded=1`}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MobileShell>
  );
};

export default InstructorSubscription;
