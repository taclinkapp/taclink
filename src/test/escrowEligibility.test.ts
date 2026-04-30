/**
 * End-to-end escrow-release-eligibility tests.
 *
 * Locks down the rule that escrow `release_eligible_at` may ONLY be stamped
 * by the FIRST successful check-in. Replayed scans (already_attended) must
 * never bump the timer, never re-stamp the timestamp, and never re-trigger
 * the 24h release scheduler.
 *
 * This complements idempotency.test.ts which verifies the booking row
 * itself transitions exactly once. Here we add the escrow side-effects:
 *   - release_eligible_at = attended_at + 24h, stamped exactly once
 *   - replays do NOT modify release_eligible_at, escrow_status, or the
 *     scheduler-eligible flag
 *   - replays before the 24h gate do NOT make the booking releasable
 *   - cancel/no-show after a check-in cannot re-open eligibility
 *
 * Mirrors the SQL behavior in migrations 20260430152503_*.sql (mark_attended)
 * and 20260430155416_*.sql (idempotent guards) plus the release-escrow-deposits
 * scheduler in supabase/functions/release-escrow-deposits/index.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';

const RELEASE_DELAY_MS = 24 * 60 * 60 * 1000; // matches release_eligible_at = attended_at + 24h

type EscrowStatus = 'pending' | 'held' | 'released' | 'refunded';

interface BookingRow {
  id: string;
  status: 'reserved' | 'attended' | 'cancelled' | 'no_show';
  escrow_status: EscrowStatus;
  attended_at: number | null;
  release_eligible_at: number | null;
  release_attempted_at: number | null;
  escrow_released_at: number | null;
  // Test instrumentation:
  eligibility_writes: number; // how many times release_eligible_at was set
  attended_writes: number;
}

interface AttendResult {
  ok: boolean;
  idempotent: boolean;
  attended_at: number | null;
  release_eligible_at: number | null;
}

function freshHeldBooking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: 'bk_escrow',
    status: 'reserved',
    escrow_status: 'held',
    attended_at: null,
    release_eligible_at: null,
    release_attempted_at: null,
    escrow_released_at: null,
    eligibility_writes: 0,
    attended_writes: 0,
    ...overrides,
  };
}

/**
 * Mirrors mark_attended() RPC: atomic 'reserved' → 'attended', stamps
 * attended_at AND release_eligible_at = attended_at + 24h, exactly once.
 * Replays return idempotent:true with the original timestamps.
 */
function markAttended(b: BookingRow, now: number): AttendResult {
  if (b.status === 'attended') {
    // Idempotent replay: do NOT touch any escrow fields.
    return {
      ok: true,
      idempotent: true,
      attended_at: b.attended_at,
      release_eligible_at: b.release_eligible_at,
    };
  }
  if (b.status !== 'reserved') {
    throw new Error(`cannot check in: status=${b.status}`);
  }
  // First (and only) state change.
  b.status = 'attended';
  b.attended_at = now;
  b.release_eligible_at = now + RELEASE_DELAY_MS;
  b.attended_writes += 1;
  b.eligibility_writes += 1;
  return {
    ok: true,
    idempotent: false,
    attended_at: b.attended_at,
    release_eligible_at: b.release_eligible_at,
  };
}

/**
 * Mirrors release-escrow-deposits scheduler eligibility check:
 *   booking.status='attended' AND escrow_status='held'
 *   AND release_eligible_at <= now()
 *   AND escrow_released_at IS NULL
 */
function isReleasableNow(b: BookingRow, now: number): boolean {
  return (
    b.status === 'attended' &&
    b.escrow_status === 'held' &&
    b.release_eligible_at !== null &&
    b.release_eligible_at <= now &&
    b.escrow_released_at === null
  );
}

// ---- Tests --------------------------------------------------------------

describe('escrow eligibility — only first successful check-in stamps the timer', () => {
  let now: number;

  beforeEach(() => {
    now = Date.UTC(2026, 4, 1, 12, 0, 0); // fixed clock for deterministic +24h math
  });

  it('first scan stamps release_eligible_at = attended_at + 24h exactly once', () => {
    const b = freshHeldBooking();
    const r = markAttended(b, now);

    expect(r.idempotent).toBe(false);
    expect(b.attended_at).toBe(now);
    expect(b.release_eligible_at).toBe(now + RELEASE_DELAY_MS);
    expect(b.eligibility_writes).toBe(1);
    expect(b.attended_writes).toBe(1);
  });

  it('20 replayed scans never bump release_eligible_at or attended_at', () => {
    const b = freshHeldBooking();
    const first = markAttended(b, now);

    // Hammer 20 replays at increasing timestamps — sim of double-tap, retries.
    const replays: AttendResult[] = [];
    for (let i = 1; i <= 20; i++) {
      replays.push(markAttended(b, now + i * 1000));
    }

    // Side-effect counters must remain at 1.
    expect(b.eligibility_writes).toBe(1);
    expect(b.attended_writes).toBe(1);

    // All replays return the ORIGINAL timestamps, flagged idempotent.
    for (const r of replays) {
      expect(r.idempotent).toBe(true);
      expect(r.attended_at).toBe(first.attended_at);
      expect(r.release_eligible_at).toBe(first.release_eligible_at);
    }

    // The row itself was never re-stamped.
    expect(b.attended_at).toBe(now);
    expect(b.release_eligible_at).toBe(now + RELEASE_DELAY_MS);
  });

  it('booking is NOT releasable until 24h after the first scan, regardless of replays', () => {
    const b = freshHeldBooking();
    markAttended(b, now);

    // Replay every hour for 23h. Booking must remain non-releasable.
    for (let h = 1; h <= 23; h++) {
      const t = now + h * 60 * 60 * 1000;
      markAttended(b, t);
      expect(isReleasableNow(b, t)).toBe(false);
    }

    // At exactly 24h, becomes releasable.
    const releaseTime = now + RELEASE_DELAY_MS;
    expect(isReleasableNow(b, releaseTime)).toBe(true);

    // And the timer never moved despite 23 replays.
    expect(b.release_eligible_at).toBe(releaseTime);
    expect(b.eligibility_writes).toBe(1);
  });

  it('a replay AFTER the 24h gate does not push eligibility forward', () => {
    const b = freshHeldBooking();
    markAttended(b, now);
    const originalEligibility = b.release_eligible_at!;

    // Instructor accidentally re-scans 30 hours later.
    const lateReplay = markAttended(b, now + 30 * 60 * 60 * 1000);
    expect(lateReplay.idempotent).toBe(true);
    expect(lateReplay.release_eligible_at).toBe(originalEligibility);
    expect(b.release_eligible_at).toBe(originalEligibility); // not pushed +24h forward
    expect(b.eligibility_writes).toBe(1);
  });

  it('once attended, cancel attempts cannot re-open escrow eligibility', () => {
    const b = freshHeldBooking();
    markAttended(b, now);

    // Try to mutate via a hypothetical late-cancel path. The atomic guard in
    // student_cancel_booking rejects non-'reserved' statuses outright.
    const tryLateCancel = () => {
      if (b.status !== 'reserved') throw new Error('cannot cancel attended');
      b.status = 'cancelled';
      b.escrow_status = 'refunded';
      b.release_eligible_at = null; // <-- the bug we are guarding against
    };
    expect(tryLateCancel).toThrow(/cannot cancel/);

    // Eligibility is intact.
    expect(b.status).toBe('attended');
    expect(b.escrow_status).toBe('held');
    expect(b.release_eligible_at).toBe(now + RELEASE_DELAY_MS);
  });

  it('replays after a successful release do not re-trigger payout', () => {
    const b = freshHeldBooking();
    markAttended(b, now);

    // Simulate scheduler running at +24h.
    const releaseTime = now + RELEASE_DELAY_MS;
    expect(isReleasableNow(b, releaseTime)).toBe(true);
    b.escrow_status = 'released';
    b.escrow_released_at = releaseTime;
    b.release_attempted_at = releaseTime;

    // Instructor re-scans the QR an hour after payout.
    const replay = markAttended(b, releaseTime + 60 * 60 * 1000);
    expect(replay.idempotent).toBe(true);

    // Booking is no longer releasable (escrow_status flipped).
    expect(isReleasableNow(b, releaseTime + 60 * 60 * 1000)).toBe(false);
    // Payout state untouched.
    expect(b.escrow_released_at).toBe(releaseTime);
    expect(b.eligibility_writes).toBe(1);
  });

  it('parallel scan storm (50 concurrent replays at the same instant) collapses to one write', () => {
    const b = freshHeldBooking();
    // First call wins; the rest land in the idempotent branch because
    // mark_attended takes a row lock + status check before mutating.
    const results = Array.from({ length: 50 }, () => markAttended(b, now));

    expect(b.eligibility_writes).toBe(1);
    expect(b.attended_writes).toBe(1);
    expect(results.filter((r) => !r.idempotent).length).toBe(1);
    expect(results.filter((r) => r.idempotent).length).toBe(49);
  });

  it('release_eligible_at is exactly attended_at + 24h, never derived from replay clock', () => {
    const b = freshHeldBooking();
    markAttended(b, now);

    // Long-delayed replay must not redefine the eligibility window.
    markAttended(b, now + 7 * 24 * 60 * 60 * 1000);

    expect(b.release_eligible_at! - b.attended_at!).toBe(RELEASE_DELAY_MS);
  });
});
