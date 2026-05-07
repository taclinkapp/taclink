import { useEffect, useState } from "react";
import { Check, Circle, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type StepKey = "account" | "subscription" | "credential" | "policy";

const STEPS: { key: StepKey; label: string; short: string }[] = [
  { key: "account", label: "Account", short: "Account" },
  { key: "subscription", label: "Subscription", short: "Plan" },
  { key: "credential", label: "Credential", short: "Credential" },
  { key: "policy", label: "Policy", short: "Policy" },
];

type StatusRow = {
  complete: boolean;
  next_step: "subscription" | "credential" | "policy" | "complete";
  has_subscription: boolean;
  has_credential: boolean;
  has_policy_ack: boolean;
};

interface Props {
  /** Override the active step (otherwise inferred from RPC's next_step). */
  current?: StepKey;
  className?: string;
}

export const InstructorOnboardingProgress = ({ current, className }: Props) => {
  const { user } = useAuth();
  const [row, setRow] = useState<StatusRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .rpc("instructor_onboarding_status", { _user_id: user.id })
        .maybeSingle<StatusRow>();
      if (cancelled) return;
      setRow(data ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const completed: Record<StepKey, boolean> = {
    account: !!user,
    subscription: !!row?.has_subscription,
    credential: !!row?.has_credential,
    policy: !!row?.has_policy_ack,
  };

  const activeKey: StepKey =
    current ??
    (row?.next_step && row.next_step !== "complete" ? (row.next_step as StepKey) : "account");

  const completedCount = STEPS.filter((s) => completed[s.key]).length;
  const blockingStep = STEPS.find((s) => !completed[s.key]);

  return (
    <div
      className={cn(
        "tactical-card border-primary/30 bg-card/80 backdrop-blur p-3 space-y-2",
        className,
      )}
      data-testid="instructor-onboarding-progress"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
          Onboarding · {completedCount}/{STEPS.length}
        </div>
        {!row?.complete && blockingStep && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-primary">
            <Lock className="h-3 w-3" />
            Locked until {blockingStep.label}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isDone = completed[step.key];
          const isActive = step.key === activeKey && !isDone;
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
                  {loading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isDone ? (
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
