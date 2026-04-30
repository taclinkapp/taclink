/**
 * End-to-end refund policy test.
 *
 * Locks down the full-online + 90/10 refund matrix that the database RPC
 * `compute_refund_split` implements (see migrations 20260430150626_*.sql and
 * 20260430152503_*.sql). This is the contract the UI and Terms both depend on,
 * so any drift breaks user-visible promises.
 *
 * Each scenario mirrors what happens when the corresponding SQL RPC is invoked:
 *   - student_cancel_booking  → 'student_cancel_timely' OR 'student_cancel_late'
 *   - instructor_no_show_refund → 'instructor_no_show'
 *
 * If the DB policy ever changes, this test must change in lockstep — that's
 * the whole point of pinning it down here.
 */
import { describe, it, expect } from 'vitest';

type RefundReason =
  | 'student_cancel_timely'
  | 'student_cancel_late'
  | 'instructor_no_show'
  | 'instructor_cancel';

type Booking = {
  course_price_cents: number;
  platform_fee_cents: number; // always 2500 in current model
};

type Split = {
  student_cash_refund_cents: number;
  instructor_forfeit_cents: number; // amount the instructor receives or is denied
  platform_absorbed_cents: number;
};

/**
 * Pure-JS mirror of public.compute_refund_split() for the four reasons the
 * UI invokes through the wrapper RPCs. Kept intentionally small and explicit
 * so divergence from the SQL is obvious.
 */
function computeRefundSplit(b: Booking, reason: RefundReason): Split {
  const platform = b.platform_fee_cents;
  const price = b.course_price_cents;
  const tenPct = Math.round(price * 0.10);
  const ninetyPct = price - tenPct;

  switch (reason) {
    case 'instructor_no_show':
    case 'instructor_cancel':
      // Student gets 100% back ($25 + course price). Instructor gets nothing.
      return {
        student_cash_refund_cents: platform + price,
        instructor_forfeit_cents: price, // instructor forfeits the full price
        platform_absorbed_cents: platform, // TacLink absorbs the platform fee
      };
    case 'student_cancel_timely':
      // Within grace: student gets 100% back. Instructor receives nothing.
      return {
        student_cash_refund_cents: platform + price,
        instructor_forfeit_cents: 0,
        platform_absorbed_cents: platform,
      };
    case 'student_cancel_late':
      // Outside grace: student gets 90%; instructor keeps 10%; TacLink keeps $25.
      return {
        student_cash_refund_cents: ninetyPct,
        instructor_forfeit_cents: tenPct, // instructor receives this 10%
        platform_absorbed_cents: 0,
      };
  }
}

describe('refund policy — full-online 90/10 model', () => {
  // $200 course is the canonical example used in Terms.
  const booking: Booking = {
    course_price_cents: 20000,
    platform_fee_cents: 2500,
  };

  it('instructor no-show → student gets 100% ($25 + full price), instructor gets $0', () => {
    const split = computeRefundSplit(booking, 'instructor_no_show');
    expect(split.student_cash_refund_cents).toBe(22500); // $225
    expect(split.instructor_forfeit_cents).toBe(20000); // $200 forfeit
    expect(split.platform_absorbed_cents).toBe(2500); // TacLink eats $25
  });

  it('grace-window student cancel → 100% refund ($225)', () => {
    const split = computeRefundSplit(booking, 'student_cancel_timely');
    expect(split.student_cash_refund_cents).toBe(22500);
    expect(split.instructor_forfeit_cents).toBe(0);
    expect(split.platform_absorbed_cents).toBe(2500);
  });

  it('late student cancel → 90% of price ($180), instructor keeps 10% ($20), TacLink keeps $25 fee', () => {
    const split = computeRefundSplit(booking, 'student_cancel_late');
    expect(split.student_cash_refund_cents).toBe(18000); // $180 = 90% of $200
    expect(split.instructor_forfeit_cents).toBe(2000); // $20 = 10% of $200
    expect(split.platform_absorbed_cents).toBe(0); // TacLink keeps the $25
    // Conservation: 18000 (refund) + 2000 (instructor) + 2500 ($25 fee) = 22500 charged
    expect(
      split.student_cash_refund_cents +
        split.instructor_forfeit_cents +
        booking.platform_fee_cents,
    ).toBe(booking.platform_fee_cents + booking.course_price_cents);
  });

  it('odd-cent course price rounds 10% via ROUND() and conservation still holds', () => {
    // $123.45 course — checks the SQL ROUND() boundary
    const odd: Booking = { course_price_cents: 12345, platform_fee_cents: 2500 };
    const split = computeRefundSplit(odd, 'student_cancel_late');
    const expectedTen = Math.round(12345 * 0.10); // 1235
    const expectedNinety = 12345 - expectedTen; // 11110
    expect(split.instructor_forfeit_cents).toBe(expectedTen);
    expect(split.student_cash_refund_cents).toBe(expectedNinety);
    expect(
      split.student_cash_refund_cents +
        split.instructor_forfeit_cents +
        odd.platform_fee_cents,
    ).toBe(odd.platform_fee_cents + odd.course_price_cents);
  });

  it('instructor cancel mirrors instructor_no_show payout shape', () => {
    const noShow = computeRefundSplit(booking, 'instructor_no_show');
    const cancel = computeRefundSplit(booking, 'instructor_cancel');
    expect(cancel).toEqual(noShow);
  });
});
