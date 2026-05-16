import { Crown, Lock } from "lucide-react";
import { useFounderStatus } from "@/hooks/useFounderStatus";
import { usePrelaunch } from "@/hooks/usePrelaunch";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

/**
 * Status card for the Subscription page. Explains the founder perk in plain
 * English and never overstates entitlement after expiry.
 */
export const FoundingInstructorCard = () => {
  const { record, isPendingPrelaunch, isActive, isExpired, hasFreeProNow } = useFounderStatus();
  const { data: prelaunch } = usePrelaunch();
  if (!record) return null;

  const launchStr = fmtDate(prelaunch?.launchDateIso ?? null);
  const endsStr = fmtDate(record.free_pro_ends_at);
  const startsStr = fmtDate(record.free_pro_starts_at);

  return (
    <div className="tactical-card border-primary/50 bg-primary/10 p-4 space-y-2" data-testid="founding-instructor-card">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-md bg-primary/20 flex items-center justify-center">
          <Crown className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="text-sm font-black">Founding Instructor</div>
          <div className="text-[11px] text-muted-foreground">Rank #{record.founder_rank} of 1,000</div>
        </div>
      </div>

      {isPendingPrelaunch && (
        <div className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Your free 6 months of Pro starts on launch day{launchStr ? ` (${launchStr})` : ""}.
          </span>
        </div>
      )}

      {isActive && hasFreeProNow && endsStr && (
        <div className="text-xs">
          <div className="font-bold text-foreground">Pro free until {endsStr}</div>
          {startsStr && (
            <div className="text-muted-foreground mt-0.5">Started {startsStr}. No payment required.</div>
          )}
        </div>
      )}

      {isExpired && (
        <div className="text-xs text-muted-foreground">
          Your founder Pro period ended{endsStr ? ` on ${endsStr}` : ""}. You can upgrade to paid Pro below to keep the perks.
        </div>
      )}
    </div>
  );
};
