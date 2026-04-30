/**
 * End-to-end idempotency tests for booking state transitions.
 *
 * Mirrors the contract enforced by the SQL RPCs hardened in migration
 * 20260430155416_*.sql:
 *   - mark_attended (QR check-in)        → 'reserved' → 'attended' exactly once
 *   - student_cancel_booking             → 'reserved' → 'cancelled' exactly once
 *   - instructor_no_show_refund          → 'reserved' → 'no_show_instructor'
 *   - student_no_show_refund             → 'reserved' → 'no_show_student'
 *
 * The contract under test:
 *   1. Repeated submissions never produce a second status change.
 *   2. Repeated submissions return the SAME refund payload as the first call,
 *      flagged with `idempotent: true`.
 *   3. The refund payload itself matches `compute_refund_split` (locked in
 *      refundPolicy.test.ts) so callers can rely on a stable shape.
 *
 * Implemented as a pure-JS simulator of the RPCs so we can hammer them in a
 * tight loop without a live DB. The simulator's branching mirrors the SQL
 * `FOR UPDATE` + state-check short-circuit pattern.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ---- Domain mirror -------------------------------------------------------

type BookingStatus =
  | 'reserved'
  | 'attended'
  | 'cancelled'
  | 'no_show_instructor'
  | 'no_show_student';

type RefundReason =
  | 'student_cancel_timely'
  | 'student_cancel_late'
  | 'instructor_no_show'
  | 'student_no_show';

interface BookingRow {
  id: string;
  status: BookingStatus;
  course_price_cents: number;
  platform_fee_cents: number;
  starts_at: number; // epoch ms
  attended_at: number | null;
  refund_payload: RefundPayload | null;
  status_change_count: number; // test-only audit
}

interface RefundPayload {
  reason: RefundReason | 'attended';
  student_cash_refund_cents: number;
  instructor_forfeit_cents: number;
  platform_absorbed_cents: number;
  idempotent: boolean;
}

// Pure mirror of compute_refund_split (see refundPolicy.test.ts).
function splitFor(b: BookingRow, reason: RefundReason): Omit<RefundPayload, 'idempotent'> {
  const platform = b.platform_fee_cents;
  const price = b.course_price_cents;
  const tenPct = Math.round(price * 0.10);
  const ninetyPct = price - tenPct;

  switch (reason) {
    case 'instructor_no_show':
      return {
        reason,
        student_cash_refund_cents: platform + price,
        instructor_forfeit_cents: price,
        platform_absorbed_cents: platform,
      };
    case 'student_cancel_timely':
      return {
        reason,
        student_cash_refund_cents: platform + price,
        instructor_forfeit_cents: 0,
        platform_absorbed_cents: platform,
      };
    case 'student_cancel_late':
      return {
        reason,
        student_cash_refund_cents: ninetyPct,
        instructor_forfeit_cents: tenPct,
        platform_absorbed_cents: 0,
      };
    case 'student_no_show':
      // Student never showed — instructor keeps full price, $25 fee absorbed by TacLink-or-instructor per policy.
      // Matches student_no_show_refund RPC: no cash refund, instructor receives full price.
      return {
        reason,
        student_cash_refund_cents: 0,
        instructor_forfeit_cents: price,
        platform_absorbed_cents: 0,
      };
  }
}

// ---- RPC simulator -------------------------------------------------------

const GRACE_MS = 24 * 60 * 60 * 1000; // 24h grace window

class BookingRpc {
  constructor(private row: BookingRow) {}

  get snapshot(): Readonly<BookingRow> {
    return this.row;
  }

  /** Mirrors mark_attended() — atomic 'reserved' → 'attended'. */
  markAttended(now: number): RefundPayload {
    if (this.row.status === 'attended') {
      // Idempotent replay — return cached payload.
      return { ...(this.row.refund_payload as RefundPayload), idempotent: true };
    }
    if (this.row.status !== 'reserved') {
      throw new Error(`cannot check in: status is ${this.row.status}`);
    }
    this.row.status = 'attended';
    this.row.attended_at = now;
    this.row.status_change_count += 1;
    const payload: RefundPayload = {
      reason: 'attended',
      student_cash_refund_cents: 0,
      instructor_forfeit_cents: 0,
      platform_absorbed_cents: 0,
      idempotent: false,
    };
    this.row.refund_payload = payload;
    return payload;
  }

  /** Mirrors student_cancel_booking() — grace-aware refund + idempotent replay. */
  studentCancel(now: number): RefundPayload {
    if (this.row.status === 'cancelled') {
      return { ...(this.row.refund_payload as RefundPayload), idempotent: true };
    }
    if (this.row.status !== 'reserved') {
      throw new Error(`cannot cancel: status is ${this.row.status}`);
    }
    const inGrace = this.row.starts_at - now > GRACE_MS;
    const reason: RefundReason = inGrace ? 'student_cancel_timely' : 'student_cancel_late';
    const payload: RefundPayload = { ...splitFor(this.row, reason), idempotent: false };
    this.row.status = 'cancelled';
    this.row.refund_payload = payload;
    this.row.status_change_count += 1;
    return payload;
  }

  /** Mirrors instructor_no_show_refund() — 100% refund, instructor forfeits. */
  instructorNoShow(): RefundPayload {
    if (this.row.status === 'no_show_instructor') {
      return { ...(this.row.refund_payload as RefundPayload), idempotent: true };
    }
    if (this.row.status !== 'reserved') {
      throw new Error(`cannot mark instructor no-show: status is ${this.row.status}`);
    }
    const payload: RefundPayload = { ...splitFor(this.row, 'instructor_no_show'), idempotent: false };
    this.row.status = 'no_show_instructor';
    this.row.refund_payload = payload;
    this.row.status_change_count += 1;
    return payload;
  }

  /** Mirrors student_no_show_refund() — instructor keeps fee. */
  studentNoShow(): RefundPayload {
    if (this.row.status === 'no_show_student') {
      return { ...(this.row.refund_payload as RefundPayload), idempotent: true };
    }
    if (this.row.status !== 'reserved') {
      throw new Error(`cannot mark student no-show: status is ${this.row.status}`);
    }
    const payload: RefundPayload = { ...splitFor(this.row, 'student_no_show'), idempotent: false };
    this.row.status = 'no_show_student';
    this.row.refund_payload = payload;
    this.row.status_change_count += 1;
    return payload;
  }
}

function freshBooking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: 'bk_test',
    status: 'reserved',
    course_price_cents: 20000,
    platform_fee_cents: 2500,
    starts_at: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1 week out
    attended_at: null,
    refund_payload: null,
    status_change_count: 0,
    ...overrides,
  };
}

// ---- Tests ---------------------------------------------------------------

describe('idempotency — repeated RPC submissions never double-process', () => {
  let now: number;

  beforeEach(() => {
    now = Date.now();
  });

  it('mark_attended: 25 rapid scans transition status exactly once', () => {
    const rpc = new BookingRpc(freshBooking());
    const results: RefundPayload[] = [];

    for (let i = 0; i < 25; i++) {
      results.push(rpc.markAttended(now + i));
    }

    // Status changed exactly once.
    expect(rpc.snapshot.status_change_count).toBe(1);
    expect(rpc.snapshot.status).toBe('attended');
    // attended_at pinned to the FIRST scan, not the last.
    expect(rpc.snapshot.attended_at).toBe(now);

    // First call: idempotent=false. Every subsequent call: idempotent=true with identical body.
    expect(results[0].idempotent).toBe(false);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].idempotent).toBe(true);
      const { idempotent: _a, ...firstBody } = results[0];
      const { idempotent: _b, ...replayBody } = results[i];
      expect(replayBody).toEqual(firstBody);
    }
  });

  it('student_cancel_booking (late): 10 retries return identical 90/10 payload, status changes once', () => {
    // starts_at within grace window → late cancel.
    const rpc = new BookingRpc(
      freshBooking({ starts_at: now + 2 * 60 * 60 * 1000 }), // 2h out → late
    );
    const results = Array.from({ length: 10 }, () => rpc.studentCancel(now));

    expect(rpc.snapshot.status_change_count).toBe(1);
    expect(rpc.snapshot.status).toBe('cancelled');

    // First payload locks in the 90/10 split.
    expect(results[0]).toMatchObject({
      reason: 'student_cancel_late',
      student_cash_refund_cents: 18000, // 90% of $200
      instructor_forfeit_cents: 2000, // 10%
      platform_absorbed_cents: 0,
      idempotent: false,
    });

    // All retries return the same body, just flagged idempotent.
    for (let i = 1; i < results.length; i++) {
      expect(results[i].idempotent).toBe(true);
      expect(results[i].student_cash_refund_cents).toBe(18000);
      expect(results[i].instructor_forfeit_cents).toBe(2000);
      expect(results[i].reason).toBe('student_cancel_late');
    }
  });

  it('student_cancel_booking (grace): retries pin the 100% refund payload', () => {
    const rpc = new BookingRpc(freshBooking()); // 1 week out → grace
    const first = rpc.studentCancel(now);
    const replay = rpc.studentCancel(now + 5_000);
    const replay2 = rpc.studentCancel(now + 60_000);

    expect(rpc.snapshot.status_change_count).toBe(1);
    expect(first).toMatchObject({
      reason: 'student_cancel_timely',
      student_cash_refund_cents: 22500, // $225 = $200 + $25
      instructor_forfeit_cents: 0,
      platform_absorbed_cents: 2500,
      idempotent: false,
    });
    expect(replay.idempotent).toBe(true);
    expect(replay2.idempotent).toBe(true);
    expect(replay.student_cash_refund_cents).toBe(first.student_cash_refund_cents);
  });

  it('instructor_no_show_refund: hammered submissions yield one status change', () => {
    const rpc = new BookingRpc(freshBooking());
    const results = Array.from({ length: 50 }, () => rpc.instructorNoShow());

    expect(rpc.snapshot.status_change_count).toBe(1);
    expect(rpc.snapshot.status).toBe('no_show_instructor');
    expect(results[0]).toMatchObject({
      student_cash_refund_cents: 22500,
      instructor_forfeit_cents: 20000,
      platform_absorbed_cents: 2500,
      idempotent: false,
    });
    expect(results.slice(1).every((r) => r.idempotent === true)).toBe(true);
    expect(new Set(results.map((r) => r.student_cash_refund_cents)).size).toBe(1);
  });

  it('student_no_show_refund: retries cannot reissue payout to instructor', () => {
    const rpc = new BookingRpc(freshBooking());
    const results = Array.from({ length: 8 }, () => rpc.studentNoShow());

    expect(rpc.snapshot.status_change_count).toBe(1);
    expect(rpc.snapshot.status).toBe('no_show_student');
    expect(results[0]).toMatchObject({
      student_cash_refund_cents: 0,
      instructor_forfeit_cents: 20000, // instructor keeps full $200
      idempotent: false,
    });
    for (let i = 1; i < results.length; i++) {
      expect(results[i].idempotent).toBe(true);
      expect(results[i].instructor_forfeit_cents).toBe(20000);
    }
  });

  it('cross-action conflict: cancel after attended is rejected, attended payload preserved', () => {
    const rpc = new BookingRpc(freshBooking());
    rpc.markAttended(now);
    expect(() => rpc.studentCancel(now + 1)).toThrow(/cannot cancel/);
    expect(() => rpc.instructorNoShow()).toThrow(/cannot mark instructor no-show/);
    // Status untouched after rejected attempts.
    expect(rpc.snapshot.status).toBe('attended');
    expect(rpc.snapshot.status_change_count).toBe(1);
  });

  it('attended replay after a real check-in always reports idempotent=true', () => {
    const rpc = new BookingRpc(freshBooking());
    const first = rpc.markAttended(now);
    expect(first.idempotent).toBe(false);
    // Simulate 100 stray re-scans (instructor mashing the button, double-tap, etc.)
    for (let i = 0; i < 100; i++) {
      const replay = rpc.markAttended(now + 1000 + i);
      expect(replay.idempotent).toBe(true);
    }
    expect(rpc.snapshot.status_change_count).toBe(1);
    expect(rpc.snapshot.attended_at).toBe(now); // never overwritten
  });

  it('interleaved cancel + no-show retries: only the first action wins', () => {
    const rpc = new BookingRpc(freshBooking({ starts_at: now + 60 * 60 * 1000 })); // late window
    const cancelPayload = rpc.studentCancel(now);
    expect(cancelPayload.idempotent).toBe(false);

    // Subsequent no-show / re-cancel attempts must not mutate status.
    expect(() => rpc.instructorNoShow()).toThrow();
    expect(() => rpc.studentNoShow()).toThrow();
    const replayCancel = rpc.studentCancel(now + 10_000);

    expect(rpc.snapshot.status).toBe('cancelled');
    expect(rpc.snapshot.status_change_count).toBe(1);
    expect(replayCancel.idempotent).toBe(true);
    expect(replayCancel.student_cash_refund_cents).toBe(cancelPayload.student_cash_refund_cents);
  });
});
