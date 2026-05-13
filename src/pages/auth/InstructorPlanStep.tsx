import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/MobileShell';
import { CheckCircle2, Crown, Sparkles, Lock } from 'lucide-react';
import { fmt, INSTRUCTOR_SUBSCRIPTION_CENTS } from '@/lib/fees';
import { getInstructorDraft, updateInstructorDraft } from '@/lib/instructorSignupDraft';
import { InstructorDraftProgress } from '@/components/InstructorDraftProgress';
import { CountdownClock } from '@/components/CountdownClock';
import { usePrelaunch } from '@/hooks/usePrelaunch';
import splashBg from '@/assets/splash-bg.mp4.asset.json';

/**
 * Guest plan-picker step in the deferred instructor signup. The user can
 * only pick Free here — Pro requires an existing account so it's offered
 * later from Settings. Choosing Free advances to the credential step.
 */
const InstructorPlanStep = () => {
  const nav = useNavigate();
  const { data: prelaunch } = usePrelaunch();
  const isPrelaunch = !!prelaunch?.enabled;
  const launchDateStr = prelaunch?.launchDateIso
    ? new Date(prelaunch.launchDateIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const [selected, setSelected] = useState<'free' | 'pro'>('free');

  useEffect(() => {
    if (!getInstructorDraft()) {
      nav('/auth/instructor-signup', { replace: true });
    }
  }, [nav]);

  const choose = () => {
    updateInstructorDraft({ plan: selected });
    nav('/auth/instructor/credential', { replace: true });
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <DeferredBackgroundVideo src={splashBg.url} className="fixed inset-0 w-full h-full object-cover opacity-40 pointer-events-none" />
      <div aria-hidden className="fixed inset-0 bg-gradient-to-b from-background/60 via-background/70 to-background pointer-events-none" />
      <div className="relative z-10">
        <PageHeader title="Choose Your Plan" back backTo="/auth/instructor-signup" />
        <div className="max-w-md mx-auto px-6 py-6 space-y-4">
          <InstructorDraftProgress current="plan" completed={{ account: true }} />
          <p className="text-xs text-muted-foreground">
            Pro unlocks AI tools and instructor analytics — available from Settings once your account is active.
          </p>

          <button
            type="button"
            onClick={() => setSelected('free')}
            className={`tactical-card w-full text-left p-5 space-y-3 transition-all ${
              selected === 'free' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
            }`}
          >
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
              {selected === 'free' && (
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              )}
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 pl-1">
              <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> Publish unlimited courses</li>
              <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> Roster, attendance & check-in tools</li>
              <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> 10% listing fee per course</li>
            </ul>
          </button>

          <button
            type="button"
            onClick={() => !isPrelaunch && setSelected('pro')}
            disabled={isPrelaunch}
            className={`tactical-card w-full text-left p-5 space-y-3 relative transition-all ${
              isPrelaunch
                ? 'border-primary/30 opacity-70 cursor-not-allowed'
                : selected === 'pro'
                ? 'border-primary bg-primary/10'
                : 'border-primary/30 hover:border-primary/60'
            }`}
          >
            {isPrelaunch ? (
              <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-sm flex items-center gap-1">
                <Lock className="h-3 w-3" /> Locked
              </span>
            ) : selected === 'pro' ? (
              <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center">
                <Crown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-lg font-black">Pro</div>
                <div className="text-xs text-muted-foreground">{fmt(INSTRUCTOR_SUBSCRIPTION_CENTS)} / month</div>
              </div>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 pl-1">
              <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> Everything in Free</li>
              <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> <strong className="text-foreground">AI course builder:</strong> auto-suggest titles, descriptions, waivers</li>
              <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> AI-powered fee insights & payout summaries</li>
              <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> Local demand & instructor analytics</li>
            </ul>
            {isPrelaunch && (
              <div className="border-t border-primary/20 pt-3 space-y-2">
                <CountdownClock />
                <p className="text-[10px] text-center text-muted-foreground uppercase tracking-wider">
                  Pro unlocks {launchDateStr ?? 'at launch'}
                </p>
              </div>
            )}
          </button>

          <Button onClick={choose} className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
            Continue with {selected === 'pro' ? 'Pro' : 'Free'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InstructorPlanStep;
