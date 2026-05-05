import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mocks ---------------------------------------------------------------
let prelaunchEnabled = false;
let subscriptionRow: any = null;

vi.mock('@/hooks/usePrelaunch', () => ({
  usePrelaunch: () => ({
    data: { enabled: prelaunchEnabled, launchDateIso: '2099-01-01T12:00:00Z' },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    subscription: subscriptionRow,
    loading: false,
    isActive: !!subscriptionRow,
    isPastDue: false,
    isCanceledGrace: false,
    isLapsed: false,
    hasNeverSubscribed: !subscriptionRow,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user', email: 't@example.com' } }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    from: () => ({
      select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }),
    }),
  },
}));

vi.mock('@/components/SubscriptionEmbeddedCheckout', () => ({
  SubscriptionEmbeddedCheckout: () => <div data-testid="checkout-mock" />,
}));

vi.mock('@/lib/paymentEnv', () => ({ getPaymentEnvironment: () => 'sandbox' }));

// MobileShell uses CSS-only bits; render-through is fine.
import InstructorSubscription from './InstructorSubscription';

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <StrictMode>
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <InstructorSubscription />
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
};

beforeEach(() => {
  cleanup();
  subscriptionRow = null;
});

describe('InstructorSubscription tier gating', () => {
  it('Free tier active and Pro upgrade enabled when prelaunch is OFF', async () => {
    prelaunchEnabled = false;
    renderPage();
    await waitFor(() => screen.getByTestId('pro-upgrade-button'));
    const btn = screen.getByTestId('pro-upgrade-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toMatch(/Upgrade to Pro/i);
    expect(screen.queryByTestId('pro-prelaunch-countdown')).toBeNull();
    expect(screen.getByText(/^Free$/)).toBeInTheDocument();
  });

  it('Pro checkout disabled and countdown shown when prelaunch is ON (survives StrictMode double-mount)', async () => {
    prelaunchEnabled = true;
    renderPage();
    await waitFor(() => screen.getByTestId('pro-upgrade-button'));
    const btn = screen.getByTestId('pro-upgrade-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/Available/i);
    expect(screen.getByTestId('pro-prelaunch-countdown')).toBeInTheDocument();
    expect(screen.getByText(/Pro unlocks at launch/i)).toBeInTheDocument();
  });

  it('does not navigate away during prelaunch — page still renders Free tier', async () => {
    prelaunchEnabled = true;
    renderPage();
    await waitFor(() => screen.getByTestId('pro-upgrade-button'));
    // Free card "Current" badge should be visible since user has no sub
    expect(screen.getAllByText(/Current/i).length).toBeGreaterThan(0);
  });
});
