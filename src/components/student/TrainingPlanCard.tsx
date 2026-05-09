import { Link } from "react-router-dom";
import { Target, ChevronRight, Loader2, Compass, MapPin } from "lucide-react";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useTrainingGoals } from "@/hooks/useTrainingGoals";
import { PILLAR_BY_ID, type PillarId } from "@/lib/pillars";
import { GOAL_LABEL, EXPERIENCE_LABEL } from "@/lib/trainingPlan";
import type { TrainingGoal, ExperienceLevel } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

/**
 * Surfaces the student's onboarding preferences as their living Training Plan,
 * with live progress against the auto-seeded goal(s).
 */
export const TrainingPlanCard = ({ className }: { className?: string }) => {
  const { row, loading } = useOnboarding();
  const { goals, isLoading: goalsLoading } = useTrainingGoals();

  if (loading) {
    return (
      <div className={cn("tactical-card p-4 flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your training plan…
      </div>
    );
  }

  // No quiz answers yet → CTA to take it.
  if (!row?.training_goal) {
    return (
      <Link
        to="/welcome/quiz"
        className={cn(
          "tactical-card p-4 flex items-center gap-3 hover:border-primary/40 transition",
          className,
        )}
      >
        <div className="h-10 w-10 rounded-md bg-primary/15 grid place-items-center text-primary">
          <Compass className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold">Build your training plan</div>
          <div className="text-xs text-muted-foreground">Answer 3 quick questions to set your goal.</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    );
  }

  const goal = row.training_goal as TrainingGoal;
  const exp = (row.experience_level ?? null) as ExperienceLevel | null;
  const pillars = (row.selected_pillars ?? []) as PillarId[];
  const radius = row.travel_radius_miles;

  return (
    <div className={cn("tactical-card p-4 space-y-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">
            My Training Plan
          </div>
          <div className="mt-0.5 text-base font-black truncate">{GOAL_LABEL[goal]}</div>
          {exp && (
            <div className="text-xs text-muted-foreground">{EXPERIENCE_LABEL[exp]}</div>
          )}
        </div>
        <div className="h-10 w-10 rounded-md bg-primary/15 grid place-items-center text-primary shrink-0">
          <Target className="h-5 w-5" />
        </div>
      </div>

      {/* Focus pillars */}
      {pillars.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
            Focus pillars
          </div>
          <div className="flex flex-wrap gap-1.5">
            {pillars.map((p) => {
              const meta = PILLAR_BY_ID[p];
              if (!meta) return null;
              return (
                <span
                  key={p}
                  className="text-[11px] font-bold px-2 py-0.5 rounded-md border border-border bg-muted/40"
                >
                  <span className="mr-1">{meta.emoji}</span>
                  {meta.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Radius */}
      {radius != null && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {radius === 0 ? "Any distance" : `Within ${radius} mi`}
        </div>
      )}

      {/* Live progress */}
      <div className="pt-1 border-t border-border/60 space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
          Progress
        </div>
        {goalsLoading ? (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        ) : goals.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            We'll create your starter goal after your first sign-in.
          </div>
        ) : (
          <ul className="space-y-2">
            {goals.slice(0, 3).map((g) => (
              <li key={g.id}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold truncate">{g.title}</div>
                  <div className={cn(
                    "text-[10px] font-bold tabular-nums",
                    g.isComplete ? "text-emerald-500" : "text-muted-foreground",
                  )}>
                    {g.current}/{g.target_count}
                  </div>
                </div>
                <div className="mt-1 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all",
                      g.isComplete ? "bg-emerald-500" : "bg-primary",
                    )}
                    style={{ width: `${g.percent}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <Link
          to="/student/progress"
          className="text-[11px] font-bold text-primary inline-flex items-center gap-1 hover:underline"
        >
          View full progress <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
};
