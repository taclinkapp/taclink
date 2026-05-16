import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFounderStatus } from "@/hooks/useFounderStatus";

type Props = {
  className?: string;
  showRank?: boolean;
  /** When true, render even for pending_prelaunch founders. Default: true. */
  includePending?: boolean;
};

/**
 * Compact "Founding Instructor" pill. Returns null when the current user is
 * not a founder. Hidden for revoked/expired statuses by default.
 */
export const FoundingInstructorBadge = ({ className, showRank = false, includePending = true }: Props) => {
  const { record, isActive, isPendingPrelaunch } = useFounderStatus();
  if (!record) return null;
  const visible = isActive || (includePending && isPendingPrelaunch);
  if (!visible) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary",
        className,
      )}
      data-testid="founding-instructor-badge"
      title={isPendingPrelaunch ? "Founding Instructor — Pro unlocks on launch day" : "Founding Instructor"}
    >
      <Crown className="h-3 w-3" />
      Founding Instructor
      {showRank && <span className="text-primary/70">#{record.founder_rank}</span>}
    </span>
  );
};
