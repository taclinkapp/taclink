import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { SendDepositCard } from "./SendDepositCard";

// --- Mocks ---------------------------------------------------------------

const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...a: any[]) => toastError(...a),
    success: (...a: any[]) => toastSuccess(...a),
  },
}));

const handleRow = {
  id: "h1",
  instructor_id: "instr-1",
  method_type: "cashapp",
  handle: "$jane",
  is_preferred: true,
  created_at: "2026-01-01T00:00:00Z",
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            order: () =>
              Promise.resolve({ data: [handleRow], error: null }),
          }),
        }),
      }),
      // not used by this test, but defensive
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

const baseProps = {
  bookingId: "bk1",
  instructorId: "instr-1",
  courseTitle: "Pistol Fundamentals",
  depositCents: 2500,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  onChanged: vi.fn(),
};

beforeEach(() => {
  toastError.mockClear();
  toastSuccess.mockClear();
});

// --- Tests ----------------------------------------------------------------

describe("SendDepositCard deep-link guard", () => {
  it("renders an active deep-link only while pending_send", async () => {
    render(<SendDepositCard {...baseProps} depositStatus="pending_send" />);
    const link = await screen.findByRole("link", {
      name: /Open Cash App with amount prefilled/i,
    });
    expect(link).toHaveAttribute("href", expect.stringContaining("cash.app"));
    expect(link).not.toHaveAttribute("aria-disabled", "true");
  });

  it("blocks the deep-link click when status is awaiting_confirmation", async () => {
    render(
      <SendDepositCard
        {...baseProps}
        depositStatus="awaiting_confirmation"
      />,
    );
    // awaiting_confirmation renders the status card, not the picker —
    // so the deep link is not present at all (which is also a valid block).
    await waitFor(() => {
      expect(
        screen.getByText(/Waiting on instructor confirmation/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("link", { name: /Open Cash App/i }),
    ).not.toBeInTheDocument();
  });

  it("does not render any payment deep-link when status is confirmed", async () => {
    render(<SendDepositCard {...baseProps} depositStatus="confirmed" />);
    await waitFor(() => {
      expect(screen.getByText(/Deposit confirmed/i)).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("link", { name: /Open Cash App/i }),
    ).not.toBeInTheDocument();
  });

  it("does not render any payment deep-link when status is expired", async () => {
    render(<SendDepositCard {...baseProps} depositStatus="expired" />);
    await waitFor(() => {
      expect(
        screen.getByText(/Deposit window expired/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("link", { name: /Open Cash App/i }),
    ).not.toBeInTheDocument();
  });

  it("when pending, the deep-link click is NOT prevented (sanity)", async () => {
    render(<SendDepositCard {...baseProps} depositStatus="pending_send" />);
    const link = await screen.findByRole("link", {
      name: /Open Cash App with amount prefilled/i,
    });
    const evt = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(false);
    expect(toastError).not.toHaveBeenCalled();
  });
});
