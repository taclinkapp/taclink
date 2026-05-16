import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePublicFounderBadge } from "@/hooks/usePublicFounderBadge";

type Props = {
  userId: string | null | undefined;
  className?: string;
  /** "pill" = full label with text. "icon" = compact crown-only badge for tight rows. */
  variant?: "pill" | "icon";
  showRank?: boolean;
};

/**
 * Public-facing Founding Instructor badge. Renders for ANY user the viewer
 * is looking at (e.g. a student looking at an instructor's course card),
 * not just the logged-in user. Hidden for non-founders and for
 * revoked/expired founders.
 */
export const FounderBadgePublic = ({ userId, className, variant = "icon", showRank = false }: Props) => {
  const { data } = usePublicFounderBadge(userId);
  if (!data) return null;

  const title =
    data.founder_status === "pending_prelaunch"
      ? `Founding Instructor #${data.founder_rank} — Pro unlocks on launch day`
      : `Founding Instructor #${data.founder_rank} of 1,000`;

  if (variant === "icon") {
    return (
      <span
        title={title}
        aria-label={title}
        data-testid="founder-badge-public"
        className={cn(
          "inline-flex items-center justify-center h-5 w-5 rounded-sm border border-primary/40 bg-primary/15 text-primary shrink-0",
          className,
        )}
      >
        <Crown className="h-3 w-3" />
      </span>
    );
  }

  return (
    <span
      title={title}
      data-testid="founder-badge-public"
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary",
        className,
      )}
    >
      <Crown className="h-3 w-3" />
      Founding Instructor
      {showRank && <span className="text-primary/70">#{data.founder_rank}</span>}
    </span>
  );
};
