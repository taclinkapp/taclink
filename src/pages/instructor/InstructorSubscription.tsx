import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { fmt, INSTRUCTOR_SUBSCRIPTION_CENTS } from '@/lib/fees';

const InstructorSubscription = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const active = profile?.subscription_status === 'active';

  const toggle = async (next: 'active' | 'inactive') => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ subscription_status: next, subscription_updated_at: new Date().toISOString() })
      .eq('id', user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(next === 'active' ? 'Subscription activated' : 'Subscription cancelled');
    refreshProfile();
  };

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="Instructor Subscription" back />
      <div className="px-4 py-4 space-y-4">
        <div className="tactical-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-lg font-black">{fmt(INSTRUCTOR_SUBSCRIPTION_CENTS)} / month</div>
              <div className="text-xs text-muted-foreground">Required to publish courses</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {active ? (
              <><CheckCircle2 className="h-4 w-4 text-primary" /><span className="font-semibold">Active</span></>
            ) : (
              <><XCircle className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Inactive</span></>
            )}
          </div>
        </div>

        <div className="tactical-card p-4 text-xs text-muted-foreground space-y-2">
          <div className="font-bold text-foreground uppercase tracking-wider text-[10px]">What's included</div>
          <ul className="list-disc pl-4 space-y-1">
            <li>Unlimited published courses</li>
            <li>10% platform commission on bookings (charged to students online)</li>
            <li>AI-powered fee insights & payout summaries</li>
          </ul>
        </div>

        {active ? (
          <Button
            disabled={busy}
            onClick={() => toggle('inactive')}
            variant="outline"
            className="w-full h-12 border-destructive/40 text-destructive font-bold"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel Subscription'}
          </Button>
        ) : (
          <Button
            disabled={busy}
            onClick={() => toggle('active')}
            className="w-full h-12 bg-primary text-primary-foreground font-bold"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Activate · ${fmt(INSTRUCTOR_SUBSCRIPTION_CENTS)}/mo`}
          </Button>
        )}

        <p className="text-[10px] text-muted-foreground text-center">
          Status tracking only. No real billing in this preview environment.
        </p>
      </div>
    </MobileShell>
  );
};

export default InstructorSubscription;
