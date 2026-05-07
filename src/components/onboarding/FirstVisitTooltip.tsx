import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { tooltipSeen, markTooltipSeen } from "@/lib/onboarding";

/**
 * One-time inline tooltip. Pure local-storage gating, no network call.
 * Place at the top of the screen body; auto-shows on first visit only.
 */
export const FirstVisitTooltip = ({
  id,
  title,
  body,
}: {
  id: string;
  title: string;
  body: string;
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!tooltipSeen(id)) setOpen(true);
  }, [id]);

  if (!open) return null;

  const dismiss = () => {
    markTooltipSeen(id);
    setOpen(false);
  };

  return (
    <div className="relative mx-3 mt-3 mb-1 rounded-xl border-2 border-primary/40 bg-primary/5 p-3 pr-9 animate-fade-in">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 p-1 rounded-md hover:bg-muted text-muted-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-primary">
        {title}
      </div>
      <div className="mt-1 text-sm text-foreground leading-snug">{body}</div>
    </div>
  );
};
