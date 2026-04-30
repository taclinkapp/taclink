/**
 * AdminAuditLog tab/button audit.
 *
 * Verifies:
 *   - All three tab buttons render and are clickable (no dead tabs).
 *   - Active tab is visually distinguished (border-primary class).
 *   - Each tab swaps to the right body (Admin actions / Booking actions / Check-in attempts).
 *   - Empty-state copy is rendered for both audit + check-in tables.
 *   - Loading spinner replaces table while data is fetching.
 *   - Booking-action rows render refund/kept amounts + reason_category badge.
 *   - Check-in rows surface the "First check-in" vs "Already checked in" labels
 *     (the user-facing distinction that proves idempotency to admins).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mocks ---------------------------------------------------------------

const mockUseAuditLog = vi.fn();
vi.mock('@/hooks/useAdminData', () => ({
  useAuditLog: (limit?: number) => mockUseAuditLog(limit),
}));

vi.mock('@/integrations/supabase/client', () => {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn(() => Promise.resolve({ data: (globalThis as any).__checkinRows ?? [], error: null })),
  };
  return {
    supabase: { from: vi.fn(() => builder) },
  };
});

// AdminHeader pulls in app context — stub it.
vi.mock('@/pages/admin/AdminDashboard', () => ({
  AdminHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header data-testid="admin-header">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  ),
}));

// Now safe to import.
import { AdminAuditLog } from './AdminAuditLog';

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

beforeEach(() => {
  mockUseAuditLog.mockReset();
  (globalThis as any).__checkinRows = [];
});

afterEach(() => {
  cleanup();
});

describe('AdminAuditLog — tabs, buttons, and idempotency-aware copy', () => {
  it('renders all three tab buttons and they are clickable', () => {
    mockUseAuditLog.mockReturnValue({ data: [], isLoading: false });
    wrap(<AdminAuditLog />);
    const tabNames = ['Admin actions', 'Booking actions', 'Check-in attempts'];
    for (const name of tabNames) {
      const btn = screen.getByRole('button', { name });
      expect(btn).toBeEnabled();
    }
  });

  it('default tab is "Admin actions" with primary styling', () => {
    mockUseAuditLog.mockReturnValue({ data: [], isLoading: false });
    wrap(<AdminAuditLog />);
    const active = screen.getByRole('button', { name: 'Admin actions' });
    expect(active.className).toMatch(/text-primary/);
    expect(active.className).toMatch(/border-primary/);
  });

  it('clicking "Booking actions" filters to source=rpc rows and renders refund/kept amounts', () => {
    mockUseAuditLog.mockReturnValue({
      data: [
        // Manual admin action — should NOT show under "Booking actions".
        { id: 'a1', source: 'admin_ui', action: 'force_refund', target_type: 'booking', target_id: 'bk-deadbeef-1111', after_value: {}, created_at: '2026-04-30T10:00:00Z', reason: 'manual override' },
        // RPC-driven booking action with full payload.
        { id: 'a2', source: 'rpc', action: 'student_cancel_booking', target_type: 'booking', target_id: 'bk-deadbeef-2222', admin_id: 'aaaaaaaa-1111-2222-3333-444444444444', after_value: { student_refund_cents: 18000, instructor_kept_cents: 2000, reason_category: 'student_cancel_late' }, created_at: '2026-04-30T11:00:00Z', reason: 'past grace window' },
      ],
      isLoading: false,
    });
    wrap(<AdminAuditLog />);

    fireEvent.click(screen.getByRole('button', { name: 'Booking actions' }));

    // The 90/10 refund split surfaced in the table.
    expect(screen.getByText('$180.00')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();
    expect(screen.getByText('student_cancel_late')).toBeInTheDocument();
    expect(screen.getByText('student_cancel_booking')).toBeInTheDocument();

    // The admin_ui action must NOT bleed in.
    expect(screen.queryByText('force_refund')).not.toBeInTheDocument();
  });

  it('"Admin actions" tab hides RPC rows', () => {
    mockUseAuditLog.mockReturnValue({
      data: [
        { id: 'a1', source: 'admin_ui', action: 'force_refund', target_type: 'booking', target_id: 'bk-1', after_value: {}, created_at: '2026-04-30T10:00:00Z' },
        { id: 'a2', source: 'rpc', action: 'student_cancel_booking', target_type: 'booking', target_id: 'bk-2', after_value: { student_refund_cents: 22500 }, created_at: '2026-04-30T11:00:00Z' },
      ],
      isLoading: false,
    });
    wrap(<AdminAuditLog />);
    expect(screen.getByText('force_refund')).toBeInTheDocument();
    expect(screen.queryByText('student_cancel_booking')).not.toBeInTheDocument();
  });

  it('shows empty-state copy when no audit rows match the active tab', () => {
    mockUseAuditLog.mockReturnValue({ data: [], isLoading: false });
    wrap(<AdminAuditLog />);
    expect(screen.getByText('No entries yet.')).toBeInTheDocument();
  });

  it('shows loading spinner while audit data is fetching', () => {
    mockUseAuditLog.mockReturnValue({ data: [], isLoading: true });
    const { container } = wrap(<AdminAuditLog />);
    // Loader2 renders as an svg with class animate-spin.
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('"Check-in attempts" tab labels first success vs replay distinctly (idempotency proof)', async () => {
    mockUseAuditLog.mockReturnValue({ data: [], isLoading: false });
    (globalThis as any).__checkinRows = [
      { id: 'c1', outcome: 'success', source: 'qr', course_id: 'co-aaaa-1111', instructor_id: 'in-bbbb-2222', booking_id: 'bk-cccc-3333', reason: null, created_at: '2026-04-30T12:00:00Z' },
      { id: 'c2', outcome: 'already_attended', source: 'qr', course_id: 'co-aaaa-1111', instructor_id: 'in-bbbb-2222', booking_id: 'bk-cccc-3333', reason: 'replay', created_at: '2026-04-30T12:00:05Z' },
      { id: 'c3', outcome: 'wrong_course', source: 'qr', course_id: 'co-aaaa-1111', instructor_id: 'in-bbbb-2222', booking_id: null, reason: 'mismatch', created_at: '2026-04-30T12:00:10Z' },
    ];

    wrap(<AdminAuditLog />);
    fireEvent.click(screen.getByRole('button', { name: 'Check-in attempts' }));

    // Wait for react-query to resolve.
    await screen.findByText('First check-in');
    expect(screen.getByText('Already checked in')).toBeInTheDocument();
    expect(screen.getByText('Wrong course')).toBeInTheDocument();
  });

  it('"Check-in attempts" tab shows empty-state when no attempts logged', async () => {
    mockUseAuditLog.mockReturnValue({ data: [], isLoading: false });
    (globalThis as any).__checkinRows = [];
    wrap(<AdminAuditLog />);
    fireEvent.click(screen.getByRole('button', { name: 'Check-in attempts' }));
    expect(await screen.findByText('No check-in attempts logged yet.')).toBeInTheDocument();
  });

  it('every tab button toggles the active state (no dead tabs)', () => {
    mockUseAuditLog.mockReturnValue({ data: [], isLoading: false });
    wrap(<AdminAuditLog />);
    const tabs = ['Admin actions', 'Booking actions', 'Check-in attempts'] as const;
    for (const name of tabs) {
      const btn = screen.getByRole('button', { name });
      fireEvent.click(btn);
      expect(btn.className).toMatch(/text-primary/);
      expect(btn.className).toMatch(/border-primary/);
      // The other two must NOT carry the active styling at the same time.
      const others = tabs.filter((t) => t !== name);
      for (const o of others) {
        expect(screen.getByRole('button', { name: o }).className).not.toMatch(/border-primary/);
      }
    }
  });
});
