// Bridges onboarding quiz answers into an actionable, trackable Training Plan.
import { supabase } from "@/integrations/supabase/client";
import type { TrainingGoal as OnbGoal, ExperienceLevel } from "@/lib/onboarding";
import type { PillarId } from "@/lib/pillars";
import { PILLAR_BY_ID } from "@/lib/pillars";

/** Human-readable label for the onboarding goal selection. */
export const GOAL_LABEL: Record<OnbGoal, string> = {
  self_defense: "Self-Defense Ready",
  competition: "Competition-Ready",
  career: "Career Track",
  stay_sharp: "Stay Sharp",
};

export const EXPERIENCE_LABEL: Record<ExperienceLevel, string> = {
  new: "New to training",
  civilian: "Civilian shooter",
  mil_le: "Military / LE",
  instructor: "Instructor",
};

/** How many courses, in 90 days, the starter plan should target per goal. */
export const GOAL_TARGET_COUNT: Record<OnbGoal, number> = {
  self_defense: 3,
  competition: 6,
  career: 10,
  stay_sharp: 4,
};

/** ISO date 90 days from now (used as starter deadline). */
export function ninetyDayDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().slice(0, 10);
}

const SEED_KEY = (uid: string) => `taclink_plan_seeded:${uid}`;

/**
 * Idempotently create one starter `course_count` goal from the user's
 * onboarding answers. Safe to call repeatedly:
 *  - skips if localStorage flag set
 *  - skips if the user already has any training_goals row
 *  - skips if no training_goal was chosen at quiz time
 */
export async function seedInitialPlan(
  userId: string,
  goal: OnbGoal | null,
  pillars: PillarId[],
): Promise<{ seeded: boolean; reason?: string }> {
  if (!userId) return { seeded: false, reason: "no_user" };
  if (!goal) return { seeded: false, reason: "no_goal" };

  try {
    if (typeof window !== "undefined" && localStorage.getItem(SEED_KEY(userId)) === "1") {
      return { seeded: false, reason: "already_seeded_local" };
    }
  } catch {}

  const { count } = await supabase
    .from("training_goals")
    .select("id", { count: "exact", head: true })
    .eq("student_id", userId);
  if ((count ?? 0) > 0) {
    try { localStorage.setItem(SEED_KEY(userId), "1"); } catch {}
    return { seeded: false, reason: "has_existing_goals" };
  }

  const target = GOAL_TARGET_COUNT[goal];
  const focus = pillars
    .map((p) => PILLAR_BY_ID[p]?.name)
    .filter(Boolean)
    .join(" · ");

  const { error } = await supabase.from("training_goals").insert({
    student_id: userId,
    title: `${GOAL_LABEL[goal]} — ${target} courses in 90 days`,
    description: focus ? `Focus pillars: ${focus}` : null,
    goal_type: "course_count",
    target_count: target,
    category: null,
    deadline: ninetyDayDeadline(),
  });

  if (error) return { seeded: false, reason: error.message };

  try { localStorage.setItem(SEED_KEY(userId), "1"); } catch {}
  return { seeded: true };
}
