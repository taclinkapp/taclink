import { Link } from "react-router-dom";
import { AlertTriangle, Crown } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

/**
 * Banner shown on the instructor dashboard when their Pro sub has lapsed
 * (canceled past period end, unpaid, etc.). Hidden if they're active or
 * have never subscribed.
 */
export const LapsedSubscriptionBanner = () => {
  const { subscription, isActive, isLapsed, isPastDue } = useSubscription();
  if (isActive || !subscription || (!isLapsed && !isPastDue)) return null;

  return (
    <Link
      to="/instructor/subscription"
      className="mt-4 tactical-card border-amber-500/40 bg-amber-500/10 p-3 flex items-center gap-3 hover:border-amber-500/60 transition"
    >
      <div className="h-9 w-9 rounded-md bg-amber-500/20 flex items-center justify-center shrink-0">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-snug">Your Pro subscription has ended</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          AI tools and analytics are locked. Resubscribe to unlock them again.
        </p>
      </div>
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-primary shrink-0">
        <Crown className="h-3 w-3" /> Resub
      </span>
    </Link>
  );
};
