// Booking fee math — single source of truth.
// Student pays online at checkout: $25 platform fee + 10% of course price (instructor deposit).
// Remaining 90% of course price is "Due in person" to the instructor.

export const PLATFORM_FEE_CENTS = 2500; // $25 fixed
export const INSTRUCTOR_COMMISSION_PCT = 0.10; // 10%
export const INSTRUCTOR_SUBSCRIPTION_CENTS = 499; // $4.99/mo (tracked only)

export type FeeBreakdown = {
  coursePriceCents: number;
  platformFeeCents: number;
  instructorDepositCents: number; // 10% online
  dueInPersonCents: number; // 90% offline
  onlineTotalCents: number; // platform + deposit
};

export const computeFees = (coursePriceCents: number): FeeBreakdown => {
  const price = Math.max(0, Math.round(coursePriceCents));
  const instructorDepositCents = Math.round(price * INSTRUCTOR_COMMISSION_PCT);
  const dueInPersonCents = price - instructorDepositCents;
  return {
    coursePriceCents: price,
    platformFeeCents: PLATFORM_FEE_CENTS,
    instructorDepositCents,
    dueInPersonCents,
    onlineTotalCents: PLATFORM_FEE_CENTS + instructorDepositCents,
  };
};

export const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
