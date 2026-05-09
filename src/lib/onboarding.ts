// Onboarding shared types + localStorage layer (used pre-signup).
import type { PillarId } from "@/lib/pillars";

export type ExperienceLevel = "new" | "civilian" | "mil_le" | "instructor";
export type TrainingGoal = "self_defense" | "competition" | "career" | "stay_sharp";

export type QuizAnswers = {
  experience_level: ExperienceLevel | null;
  training_goal: TrainingGoal | null;
  selected_pillars: PillarId[];
  travel_radius_miles: number | null; // 0 = any distance
};

export type ChecklistKey =
  | "profile_created"
  | "browsed_courses"
  | "first_booking"
  | "first_completion"
  | "shared_profile";

export type ChecklistState = Record<ChecklistKey, boolean>;

export const DEFAULT_CHECKLIST: ChecklistState = {
  profile_created: true,
  browsed_courses: false,
  first_booking: false,
  first_completion: false,
  shared_profile: false,
};

export const CHECKLIST_ORDER: { key: ChecklistKey; label: string }[] = [
  { key: "profile_created", label: "Create your profile" },
  { key: "browsed_courses", label: "Browse courses near you" },
  
  { key: "first_booking", label: "Book your first course" },
  { key: "first_completion", label: "Complete a course and earn XP" },
  { key: "shared_profile", label: "Share your Operator Profile" },
];

const QUIZ_KEY = "taclink_onboarding_quiz_v1";
const TOOLTIP_PREFIX = "taclink_tooltip_shown_";

export const EMPTY_QUIZ: QuizAnswers = {
  experience_level: null,
  training_goal: null,
  selected_pillars: [],
  travel_radius_miles: null,
};

export function loadQuizLocal(): QuizAnswers {
  if (typeof window === "undefined") return EMPTY_QUIZ;
  try {
    const raw = localStorage.getItem(QUIZ_KEY);
    if (!raw) return EMPTY_QUIZ;
    return { ...EMPTY_QUIZ, ...JSON.parse(raw) };
  } catch {
    return EMPTY_QUIZ;
  }
}

export function saveQuizLocal(answers: Partial<QuizAnswers>) {
  if (typeof window === "undefined") return;
  const merged = { ...loadQuizLocal(), ...answers };
  try {
    localStorage.setItem(QUIZ_KEY, JSON.stringify(merged));
  } catch {}
}

export function clearQuizLocal() {
  try { localStorage.removeItem(QUIZ_KEY); } catch {}
}

export function tooltipSeen(id: string): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(TOOLTIP_PREFIX + id) === "1";
}

export function markTooltipSeen(id: string) {
  try { localStorage.setItem(TOOLTIP_PREFIX + id, "1"); } catch {}
}
