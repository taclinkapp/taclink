// Punch-card credit system has been removed. This file is kept as a no-op
// shim so any remaining imports compile until they're cleaned up.

export const PUNCHES_PER_CREDIT = 5;

export type PunchCardState = {
  totalPunches: number;
  punchesInCurrentCard: number;
  unredeemedCredits: number;
  nextRewardIn: number;
};

export const fetchPunchCardState = async (_instructorId: string): Promise<PunchCardState> => ({
  totalPunches: 0,
  punchesInCurrentCard: 0,
  unredeemedCredits: 0,
  nextRewardIn: PUNCHES_PER_CREDIT,
});

export const redeemFreeListingCredit = async (
  _instructorId: string,
  _courseId: string,
): Promise<string | null> => null;
