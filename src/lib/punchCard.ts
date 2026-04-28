// Punch card helpers — paid subscribers earn 1 free listing-fee credit per 5 attended courses.
import { supabase } from "@/integrations/supabase/client";

export const PUNCHES_PER_CREDIT = 5;

export type PunchCardState = {
  totalPunches: number;
  punchesInCurrentCard: number; // 0..4
  unredeemedCredits: number;
  nextRewardIn: number; // 1..5
};

export const fetchPunchCardState = async (instructorId: string): Promise<PunchCardState> => {
  const [{ count: totalPunches }, { count: unredeemed }] = await Promise.all([
    supabase
      .from("instructor_punches")
      .select("*", { count: "exact", head: true })
      .eq("instructor_id", instructorId),
    supabase
      .from("instructor_credits")
      .select("*", { count: "exact", head: true })
      .eq("instructor_id", instructorId)
      .is("redeemed_at", null),
  ]);

  const total = totalPunches ?? 0;
  const inCard = total % PUNCHES_PER_CREDIT;
  return {
    totalPunches: total,
    punchesInCurrentCard: inCard,
    unredeemedCredits: unredeemed ?? 0,
    nextRewardIn: PUNCHES_PER_CREDIT - inCard || PUNCHES_PER_CREDIT,
  };
};

/** Atomically claim one unredeemed credit for a course (returns credit id or null). */
export const redeemFreeListingCredit = async (
  instructorId: string,
  courseId: string,
): Promise<string | null> => {
  const { data: credit } = await supabase
    .from("instructor_credits")
    .select("id")
    .eq("instructor_id", instructorId)
    .eq("credit_type", "free_listing_fee")
    .is("redeemed_at", null)
    .order("earned_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!credit) return null;

  const { data: updated, error } = await supabase
    .from("instructor_credits")
    .update({ redeemed_at: new Date().toISOString(), redeemed_course_id: courseId })
    .eq("id", credit.id)
    .is("redeemed_at", null)
    .select("id")
    .maybeSingle();

  if (error || !updated) return null;
  return updated.id;
};
