import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, Crown, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fmt, INSTRUCTOR_SUBSCRIPTION_CENTS } from '@/lib/fees';
import { usePrelaunch } from '@/hooks/usePrelaunch';

const InstructorSubscription = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { data: prelaunch, isLoading: prelaunchLoading } = usePrelaunch();
  const [busy, setBusy] = useState<null | 'free' | 'active'>(null);
  const status = profile?.subscription_status ?? 'free';
  const isActive = status === 'active';
  const isFree = status === 'free' || status === 'inactive';

  // Hide the monthly subscription entirely while the platform is in pre-launch.
  if (prelaunchLoading) {
    return (
      <MobileShell withTabBar={false}>
        <PageHeader title="Subscription" back />
        <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      </MobileShell>
    );
  }
  if (prelaunch?.enabled) {
    return <Navigate to="/instructor" replace />;
  }

  const switchTo = async (next: 'active' | 'free') => {
    if (!user) return;
    setBusy(next);
    const { error } = await supabase
      .from('profiles')
      .update({ subscription_status: next, subscription_updated_at: new Date().toISOString() })
      .eq('id', user.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(next === 'active' ? 'Subscribed to Pro' : 'Switched to Free tier');
    refreshProfile();
  };

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="Subscription" back />
      <div className="px-4 py-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Choose how you want to use the platform. You can switch any time.
        </p>

        {/* Free tier */}
        <div className={cn(
          "tactical-card p-5 space-y-3 transition-all",
          isFree ? "border-primary/60 bg-primary/5" : "border-border"
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
            {isFree && (
              <span className="text-[10px] uppercase tracking-wider font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-sm">Current</span>
            )}
          </div>
          <ul className="text-xs text-muted-foreground space-y-1.5 pl-1">
            <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> Publish unlimited courses</li>
            <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> 10% listing fee per course (non-refundable)</li>
            <li className="flex gap-2 text-muted-foreground/60"><span className="h-3.5 w-3.5 shrink-0 mt-0.5">—</span> No punch card / free listings</li>
            <li className="flex gap-2 text-muted-foreground/60"><span className="h-3.5 w-3.5 shrink-0 mt-0.5">—</span> No AI payout insights</li>
            <li className="flex gap-2 text-muted-foreground/60"><span className="h-3.5 w-3.5 shrink-0 mt-0.5">—</span> No roster / check-in tools</li>
          </ul>
          {!isFree && (
            <Button
              onClick={() => switchTo('free')}
              disabled={busy !== null}
              variant="outline"
              className="w-full h-11 border-border font-bold"
            >
              {busy === 'free' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Switch to Free'}
            </Button>
          )}
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
            <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> <strong className="text-foreground">Punch card:</strong> 5 completed courses = 1 free listing (no fee)</li>
            <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> AI-powered fee insights & payout summaries</li>
            <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> Roster, attendance & check-in tools</li>
          </ul>
          {!isActive ? (
            <Button
              onClick={() => switchTo('active')}
              disabled={busy !== null}
              className="w-full h-11 bg-primary text-primary-foreground font-bold"
            >
              {busy === 'active' ? <Loader2 className="h-4 w-4 animate-spin" /> : `Upgrade to Pro · ${fmt(INSTRUCTOR_SUBSCRIPTION_CENTS)}/mo`}
            </Button>
          ) : (
            <Button
              onClick={() => switchTo('free')}
              disabled={busy !== null}
              variant="outline"
              className="w-full h-11 border-destructive/40 text-destructive font-bold"
            >
              {busy === 'free' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel & Switch to Free'}
            </Button>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          Status tracking only. No real billing in this preview environment.
        </p>
      </div>
    </MobileShell>
  );
};

export default InstructorSubscription;
