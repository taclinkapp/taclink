import { useEffect } from 'react';
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

  useEffect(() => {
    if (!getInstructorDraft()) {
      nav('/auth/instructor-signup', { replace: true });
    }
  }, [nav]);

  const choose = () => {
    updateInstructorDraft({ plan: 'free' });
    nav('/auth/instructor/credential', { replace: true });
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <video
        src={splashBg.url}
        autoPlay loop muted playsInline aria-hidden
        className="fixed inset-0 w-full h-full object-cover opacity-40 pointer-events-none"
      />
      <div aria-hidden className="fixed inset-0 bg-gradient-to-b from-background/60 via-background/70 to-background pointer-events-none" />
      <div className="relative z-10">
        <PageHeader title="Choose Your Plan" back backTo="/auth/instructor-signup" />
        <div className="max-w-md mx-auto px-6 py-6 space-y-4">
          <InstructorDraftProgress current="plan" completed={{ account: true }} />
          <p className="text-xs text-muted-foreground">
            Pro unlocks AI tools and instructor analytics — available from Settings once your account is active.
          </p>

          <div className="tactical-card p-5 space-y-3 border-primary/60 bg-primary/5">
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
              <span className="text-[10px] uppercase tracking-wider font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-sm">Recommended</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 pl-1">
              <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> Publish unlimited courses</li>
              <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> Roster, attendance & check-in tools</li>
              <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> 10% listing fee per course</li>
            </ul>
          </div>

          <div className="tactical-card p-5 space-y-3 border-primary/30">
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
          </div>

          <Button onClick={choose} className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
            Continue with Free
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InstructorPlanStep;
