import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchPunchCardState, PUNCHES_PER_CREDIT, type PunchCardState } from "@/lib/punchCard";
import { Crown, Stamp, Gift, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export const PunchCard = () => {
  const { user, profile } = useAuth();
  const isSubscribed = profile?.subscription_status === "active";
  const [state, setState] = useState<PunchCardState | null>(null);

  useEffect(() => {
    if (!user || !isSubscribed) return;
    fetchPunchCardState(user.id).then(setState).catch(() => {});
  }, [user, isSubscribed]);

  if (!isSubscribed) {
    return (
      <div className="tactical-card p-4 border-primary/30 bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">Punch Card · Subscribers Only</div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Complete {PUNCHES_PER_CREDIT} courses to earn 1 free listing — no booking fee.
              Available with the $4.99/mo subscription.
            </p>
            <Link
              to="/instructor/subscription"
              className="inline-block mt-2 text-[11px] font-bold uppercase tracking-wider text-primary hover:underline"
            >
              Upgrade to unlock →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const punches = state?.punchesInCurrentCard ?? 0;
  const credits = state?.unredeemedCredits ?? 0;

  return (
    <div className="tactical-card p-4 border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" />
          <div className="text-xs uppercase tracking-wider font-bold">Punch Card</div>
        </div>
        {credits > 0 && (
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-black bg-primary text-primary-foreground px-2 py-0.5 rounded-sm">
            <Gift className="h-3 w-3" /> {credits} free
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-1.5 mb-2">
        {Array.from({ length: PUNCHES_PER_CREDIT }).map((_, i) => {
          const filled = i < punches;
          return (
            <div
              key={i}
              className={cn(
                "flex-1 aspect-square rounded-md border-2 flex items-center justify-center transition-all",
                filled
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-primary/30 bg-background/40 text-primary/30",
              )}
            >
              <Stamp className={cn("h-5 w-5", filled && "rotate-12")} />
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {credits > 0 ? (
          <>
            <strong className="text-primary">{credits} free listing credit{credits === 1 ? "" : "s"}</strong> ready —
            auto-applied to your next published course.
          </>
        ) : punches === 0 ? (
          <>Complete {PUNCHES_PER_CREDIT} courses to earn 1 <strong className="text-foreground">free listing</strong> (no booking fee).</>
        ) : (
          <>
            {PUNCHES_PER_CREDIT - punches} more completed course{PUNCHES_PER_CREDIT - punches === 1 ? "" : "s"} until your next free listing.
          </>
        )}
      </p>
    </div>
  );
};
