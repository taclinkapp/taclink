import { useState } from "react";
import { Check, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/hooks/useOnboarding";
import { CHECKLIST_ORDER } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";

/**
 * Persistent onboarding card on student home.
 * - Shows expanded list until dismissed
 * - After dismiss, collapses to a small banner until all items complete
 * - Disappears entirely once all 6 are checked
 */
export const OnboardingChecklistCard = () => {
  const { loading, checklist, completedCount, totalCount, allDone, dismissed, dismissChecklist } = useOnboarding();
  const [expanded, setExpanded] = useState(true);

  if (loading || allDone) return null;

  const pct = Math.round((completedCount / totalCount) * 100);

  // Collapsed banner mode (after dismiss)
  if (dismissed) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full neu px-4 py-3 rounded-xl flex items-center justify-between gap-3 hover:bg-muted transition"
      >
        <div className="flex-1 text-left min-w-0">
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-primary">
            Student Onboarding
          </div>
          <div className="text-sm font-bold text-foreground truncate">
            {completedCount}/{totalCount} steps complete
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
    );
  }

  return (
    <div className="neu rounded-xl overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-primary">
            Student Onboarding
          </div>
          <div className="mt-1 text-base font-black text-foreground">
            Unlock your full Student Profile
          </div>
        </div>
        <button
          onClick={dismissChecklist}
          aria-label="Dismiss"
          className="p-1.5 -mr-1 rounded-md hover:bg-muted text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress */}
      <div className="px-4">
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-[0.65rem] font-bold text-muted-foreground">
          {completedCount} of {totalCount} complete
        </div>
      </div>

      {/* Items */}
      <ul className="px-4 py-3 space-y-2">
        {CHECKLIST_ORDER.map((item) => {
          const done = checklist[item.key];
          return (
            <li key={item.key} className="flex items-center gap-3">
              <div
                className={cn(
                  "h-5 w-5 rounded-full border-2 grid place-items-center shrink-0 transition",
                  done
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/40"
                )}
              >
                {done && <Check className="h-3 w-3" strokeWidth={3} />}
              </div>
              <span
                className={cn(
                  "text-sm",
                  done ? "text-muted-foreground line-through" : "text-foreground font-medium"
                )}
              >
                {item.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/** Full-screen post-signup welcome with founder note + checklist preview. */
export const OnboardingWelcomeModal = ({ onClose, firstName }: { onClose: () => void; firstName: string }) => {
  const { checklist } = useOnboarding();
  return (
    <div className="fixed inset-0 z-[80] bg-background overflow-y-auto">
      <div className="max-w-md mx-auto px-6 pt-12 pb-10">
        <div className="text-[0.625rem] font-bold uppercase tracking-[0.25em] text-primary">
          Welcome
        </div>
        <h1 className="mt-2 text-3xl font-black leading-tight">
          Welcome, {firstName || "Student"}
        </h1>

        {/* Founder note */}
        <div className="mt-6 neu rounded-xl p-4 flex gap-3">
          <div className="h-12 w-12 rounded-full bg-muted shrink-0 grid place-items-center text-lg font-black text-primary">
            T
          </div>
          <div className="min-w-0">
            <div className="text-sm leading-relaxed text-foreground">
              "I built TacLink because I couldn't find this when I needed it most. Welcome to the community."
            </div>
            <div className="mt-1 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
              — Founder, TacLink
            </div>
          </div>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Complete these to unlock your full Student Profile:
        </p>

        <ul className="mt-3 space-y-2.5">
          {CHECKLIST_ORDER.map((item) => {
            const done = checklist[item.key];
            return (
              <li key={item.key} className="flex items-center gap-3">
                <div className={cn(
                  "h-5 w-5 rounded-full border-2 grid place-items-center shrink-0",
                  done ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                )}>
                  {done && <Check className="h-3 w-3" strokeWidth={3} />}
                </div>
                <span className={cn("text-sm", done ? "text-muted-foreground line-through" : "text-foreground font-medium")}>
                  {item.label}
                </span>
              </li>
            );
          })}
        </ul>

        <Button size="lg" onClick={onClose} className="mt-8 w-full h-14 font-bold text-base">
          Start Exploring
        </Button>
      </div>
    </div>
  );
};
