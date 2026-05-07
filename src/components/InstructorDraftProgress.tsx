import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type StepKey = "account" | "plan" | "credential" | "policy";

const STEPS: { key: StepKey; short: string; label: string }[] = [
  { key: "account", short: "Account", label: "Account" },
  { key: "plan", short: "Plan", label: "Subscription" },
  { key: "credential", short: "Credential", label: "Credential" },
  { key: "policy", short: "Policy", label: "Policy" },
];

interface Props {
  current: StepKey;
  completed: Partial<Record<StepKey, boolean>>;
  className?: string;
}

/**
 * Progress bar for the deferred (no-auth-yet) instructor signup flow.
 * Reads from in-memory draft state instead of querying the backend.
 */
export const InstructorDraftProgress = ({ current, completed, className }: Props) => {
  const completedCount = STEPS.filter((s) => completed[s.key]).length;
  const blocking = STEPS.find((s) => !completed[s.key]);

  return (
    <div
      className={cn(
        "tactical-card border-primary/30 bg-card/80 backdrop-blur p-3 space-y-2",
        className,
      )}
      data-testid="instructor-draft-progress"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
          Onboarding · {completedCount}/{STEPS.length}
        </div>
        {blocking && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-primary">
            <Lock className="h-3 w-3" />
            Account creates after {STEPS[STEPS.length - 1].label}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isDone = !!completed[step.key];
          const isActive = step.key === current && !isDone;
          return (
            <div key={step.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className={cn(
                    "h-6 w-6 rounded-full grid place-items-center border-2 shrink-0 transition-colors",
                    isDone
                      ? "bg-primary border-primary text-primary-foreground"
                      : isActive
                      ? "border-primary text-primary bg-primary/10"
                      : "border-muted-foreground/30 text-muted-foreground/50 bg-muted/30",
                  )}
                >
                  {isDone ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : (
                    <span className="text-[10px] font-black">{i + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[9px] mt-1 font-bold uppercase tracking-wider truncate max-w-full",
                    isDone
                      ? "text-foreground"
                      : isActive
                      ? "text-primary"
                      : "text-muted-foreground/60",
                  )}
                >
                  {step.short}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 -mt-4 mx-0.5 rounded transition-colors",
                    completed[STEPS[i + 1].key] || isDone
                      ? "bg-primary"
                      : "bg-muted-foreground/20",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
