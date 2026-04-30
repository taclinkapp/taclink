/**
 * Button-state audit for ScanResultDialog.
 *
 * Verifies for every ScanOutcome variant:
 *   - The dialog renders (not a dead component for any kind).
 *   - Both action buttons exist, are enabled, and wire to the right handler.
 *   - The "Done" close button always works.
 *   - Wording for the "already_attended" idempotent-replay case matches the
 *     refund/escrow contract surfaced elsewhere ("escrow is on track").
 *
 * Catches: dead buttons, missing labels, drift between dialog copy and the
 * idempotency story we tell admins/instructors.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ScanResultDialog, type ScanOutcome } from './ScanResultDialog';

const renderDlg = (outcome: ScanOutcome) => {
  const onScanAnother = vi.fn();
  const onClose = vi.fn();
  render(
    <ScanResultDialog
      outcome={outcome}
      onScanAnother={onScanAnother}
      onClose={onClose}
    />,
  );
  return { onScanAnother, onClose };
};

describe('ScanResultDialog — every outcome has live buttons + correct copy', () => {
  afterEach(() => cleanup());

  it('returns nothing when outcome is null (no zombie dialog)', () => {
    const { container } = render(
      <ScanResultDialog outcome={null} onScanAnother={vi.fn()} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  const cases: Array<{ name: string; outcome: ScanOutcome; primary: string; bodyMatch: RegExp }> = [
    {
      name: 'success (QR)',
      outcome: { kind: 'success', bookingId: 'b1', studentName: 'Alex', source: 'qr' },
      primary: 'Scan next student',
      bodyMatch: /Alex is checked in/i,
    },
    {
      name: 'success (proximity)',
      outcome: { kind: 'success', bookingId: 'b1', studentName: 'Alex', source: 'proximity' },
      primary: 'Scan next student',
      bodyMatch: /Proximity \+ signed QR both confirmed/i,
    },
    {
      name: 'already_attended (idempotent replay)',
      outcome: { kind: 'already_attended', studentName: 'Sam' },
      primary: 'Scan next student',
      // Wording must reassure: no second check-in is needed AND escrow is on track.
      bodyMatch: /already checked in.+escrow is on track/i,
    },
    {
      name: 'pending_proximity',
      outcome: { kind: 'pending_proximity', bookingId: 'b1', studentName: 'Riley' },
      primary: 'Scan another',
      bodyMatch: /waiting for proximity|within ~10 ft/i,
    },
    {
      name: 'unsigned_warning',
      outcome: { kind: 'unsigned_warning', studentName: 'Dee' },
      primary: 'Scan again with new QR',
      bodyMatch: /older format|signed QRs are preferred/i,
    },
    {
      name: 'wrong_course',
      outcome: { kind: 'wrong_course' },
      primary: 'Try again',
      bodyMatch: /different course/i,
    },
    {
      name: 'invalid_qr',
      outcome: { kind: 'invalid_qr', reason: 'unrecognized payload' },
      primary: 'Try again',
      bodyMatch: /unrecognized payload/i,
    },
    {
      name: 'verification_failed',
      outcome: { kind: 'verification_failed', reason: 'signature expired' },
      primary: 'Try again',
      bodyMatch: /signature expired/i,
    },
    {
      name: 'cannot_checkin',
      outcome: { kind: 'cannot_checkin', bookingId: 'b1', status: 'cancelled' },
      primary: 'Scan another',
      bodyMatch: /no longer active|cannot be reverted/i,
    },
    {
      name: 'rpc_error',
      outcome: { kind: 'rpc_error', reason: 'database timeout' },
      primary: 'Retry scan',
      bodyMatch: /database timeout/i,
    },
  ];

  for (const tc of cases) {
    it(`${tc.name}: primary + Done buttons are live and copy is on-message`, () => {
      const { onScanAnother, onClose } = renderDlg(tc.outcome);

      const primary = screen.getByRole('button', { name: new RegExp(tc.primary, 'i') });
      const done = screen.getByRole('button', { name: /done/i });

      expect(primary).toBeEnabled();
      expect(done).toBeEnabled();

      // Body copy assertion (catches stale wording).
      const matches = screen.getAllByText(tc.bodyMatch);
      expect(matches.length).toBeGreaterThan(0);

      fireEvent.click(primary);
      expect(onScanAnother).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.click(done);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  }

  it('repeated already_attended replays render identical body copy each time', () => {
    // Simulates a real instructor double/triple-tapping a checked-in student.
    const outcome: ScanOutcome = { kind: 'already_attended', studentName: 'Pat' };
    const bodies: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { unmount } = render(
        <ScanResultDialog outcome={outcome} onScanAnother={vi.fn()} onClose={vi.fn()} />,
      );
      bodies.push(screen.getByText(/already checked in/i).textContent ?? '');
      unmount();
    }
    expect(new Set(bodies).size).toBe(1);
    // Final reassurance line never drifts:
    expect(bodies[0]).toMatch(/escrow is on track for release/i);
  });
});
