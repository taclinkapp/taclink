// Booking fee math — single source of truth.
// FULL-ONLINE MODEL: Student pays $25 platform fee + 100% of course price at checkout.
// Nothing is paid in person. The full course price is held in TacLink's
// merchant balance and transferred to the instructor's connected payout
// account 24h after the course ends. TacLink keeps the $25 platform fee.

export const PLATFORM_FEE_CENTS = 2500; // $25 fixed
export const INSTRUCTOR_LISTING_FEE_PCT = 0.10; // 10% of course price, charged at publish, non-refundable

// Transfer fee charged by the payout processor (Helcim/etc.) on each
// instructor payout. Flat percentage applied to the gross course price
// being transferred to the instructor's payout account. Deducted from the
// instructor's payout (the student is NOT charged this fee).
export const TRANSFER_FEE_PCT = 0.029; // 2.9% flat across all payout methods

// Kept for backwards-compat references; no longer used as a split percentage.
export const INSTRUCTOR_COMMISSION_PCT = 1.0;

export const INSTRUCTOR_SUBSCRIPTION_CENTS = 499; // $4.99/mo (tracked only)

export const computeListingFeeCents = (priceCents: number, _capacity?: number): number => {
  const p = Math.max(0, Math.round(priceCents));
  return Math.round(p * INSTRUCTOR_LISTING_FEE_PCT);
};

export const computeTransferFeeCents = (grossPayoutCents: number): number => {
  const g = Math.max(0, Math.round(grossPayoutCents));
  return Math.round(g * TRANSFER_FEE_PCT);
};

export const formatTransferFeePct = (): string =>
  `${(TRANSFER_FEE_PCT * 100).toFixed(2).replace(/\.?0+$/, '')}%`;

export type FeeBreakdown = {
  coursePriceCents: number;
  platformFeeCents: number;
  instructorDepositCents: number; // = full course price (held in escrow → released to instructor)
  dueInPersonCents: number;       // always 0 in the full-online model
  onlineTotalCents: number;       // platform fee + course price
  transferFeeCents: number;       // payout processor fee, deducted from instructor payout
  instructorNetCents: number;     // what the instructor actually receives after transfer fee
};

export const computeFees = (coursePriceCents: number): FeeBreakdown => {
  const price = Math.max(0, Math.round(coursePriceCents));
  const transferFee = computeTransferFeeCents(price);
  return {
    coursePriceCents: price,
    platformFeeCents: PLATFORM_FEE_CENTS,
    instructorDepositCents: price, // full price held in escrow for the instructor
    dueInPersonCents: 0,
    onlineTotalCents: PLATFORM_FEE_CENTS + price,
    transferFeeCents: transferFee,
    instructorNetCents: Math.max(0, price - transferFee),
  };
};

export const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
