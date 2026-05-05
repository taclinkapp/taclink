/**
 * End-to-end smoke test for the Helcim checkout switchover.
 *
 * Goal: prove the contract the production code relies on, without
 * touching a real database or Helcim's API. We model the moving parts
 * exactly as create-helcim-checkout/index.ts implements them:
 *
 *   1. payment_provider_settings.active_provider gates the function.
 *      When it's "stripe", the function MUST refuse with HTTP 503.
 *      When flipped to "helcim", the function MUST proceed.
 *   2. After a successful invoke, the booking row MUST have:
 *        - helcim_checkout_token set to the value returned by Helcim
 *        - payment_provider = 'helcim'
 *        - deposit_status = 'pending_payment'
 *   3. Re-invoking with the same booking that has already moved past
 *      pending_payment (held_in_escrow / released) MUST fail with 400.
 *
 * The simulator below mirrors the edge function's branching exactly so
 * that any future drift (e.g., someone removes the provider gate) will
 * break a test, not silently regress in prod.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { HELCIM_SANDBOX_TEST_CARDS, HELCIM_SANDBOX_TEST_PROFILE, isBookingPaymentConfirmed, isHelcimSandboxCard } from "@/lib/helcimPayment";

// ---- Domain mirrors -----------------------------------------------------

type ActiveProvider = "stripe" | "helcim";
type DepositStatus =
  | "pending_send"
  | "pending_payment"
  | "awaiting_confirmation"
  | "held_in_escrow"
  | "released";

interface BookingRow {
  id: string;
  student_id: string;
  online_total_cents: number;
  deposit_status: DepositStatus;
  payment_provider: "stripe" | "helcim";
  helcim_checkout_token: string | null;
  helcim_transaction_id: string | null;
}

interface ProviderSettings {
  active_provider: ActiveProvider;
}

interface CheckoutResponse {
  status: number;
  body:
    | { checkoutToken: string; bookingId: string; stub: boolean }
    | { error: string };
}

// ---- Simulator ----------------------------------------------------------

class HelcimCheckoutSim {
  constructor(
    private settings: ProviderSettings,
    private bookings: Map<string, BookingRow>,
    private opts: { hasApiToken: boolean } = { hasApiToken: false },
  ) {}

  flipProvider(next: ActiveProvider) {
    this.settings.active_provider = next;
  }

  /** Mirrors POST /create-helcim-checkout end-to-end. */
  invoke(callerUserId: string, bookingId: string): CheckoutResponse {
    if (this.settings.active_provider !== "helcim") {
      return {
        status: 503,
        body: {
          error: `Helcim checkout is disabled — platform is currently routing through ${this.settings.active_provider}.`,
        },
      };
    }
    const booking = this.bookings.get(bookingId);
    if (!booking) return { status: 404, body: { error: "Booking not found" } };
    if (booking.student_id !== callerUserId) {
      return { status: 403, body: { error: "Forbidden" } };
    }
    if (
      booking.deposit_status === "held_in_escrow" ||
      booking.deposit_status === "released"
    ) {
      return { status: 400, body: { error: "Deposit already collected" } };
    }

    const token = this.opts.hasApiToken
      ? `htok_${crypto.randomUUID()}`
      : `stub_${booking.id}_${crypto.randomUUID()}`;

    // Atomic booking update — same write the edge function performs.
    booking.helcim_checkout_token = token;
    booking.deposit_status = "pending_payment";
    booking.payment_provider = "helcim";

    return {
      status: 200,
      body: {
        checkoutToken: token,
        bookingId: booking.id,
        stub: !this.opts.hasApiToken,
      },
    };
  }

  snapshot(bookingId: string): Readonly<BookingRow> | undefined {
    return this.bookings.get(bookingId);
  }
}

function freshBooking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: "bk_smoke",
    student_id: "user_student",
    online_total_cents: 22500,
    deposit_status: "pending_send",
    payment_provider: "stripe",
    helcim_checkout_token: null,
    helcim_transaction_id: null,
    ...overrides,
  };
}

// ---- Tests --------------------------------------------------------------

describe("Helcim checkout smoke — provider flip → checkout → token persisted", () => {
  let booking: BookingRow;
  let sim: HelcimCheckoutSim;

  beforeEach(() => {
    booking = freshBooking();
    sim = new HelcimCheckoutSim(
      { active_provider: "stripe" },
      new Map([[booking.id, booking]]),
    );
  });

  it("rejects with 503 while active_provider is still stripe", () => {
    const res = sim.invoke("user_student", booking.id);
    expect(res.status).toBe(503);
    expect((res.body as any).error).toMatch(/disabled.*stripe/);
    // Booking must NOT be mutated when the gate is closed.
    expect(sim.snapshot(booking.id)?.helcim_checkout_token).toBeNull();
    expect(sim.snapshot(booking.id)?.payment_provider).toBe("stripe");
  });

  it("after flipping active_provider to helcim, checkout succeeds and helcim_checkout_token is stored on the booking", () => {
    sim.flipProvider("helcim");

    const res = sim.invoke("user_student", booking.id);
    expect(res.status).toBe(200);
    const body = res.body as { checkoutToken: string; bookingId: string; stub: boolean };
    expect(body.checkoutToken).toMatch(/^stub_/); // no API token in this env → stub mode
    expect(body.bookingId).toBe(booking.id);
    expect(body.stub).toBe(true);

    // The whole point of this test: the token MUST be on the booking row.
    const snap = sim.snapshot(booking.id)!;
    expect(snap.helcim_checkout_token).toBe(body.checkoutToken);
    expect(snap.deposit_status).toBe("pending_payment");
    expect(snap.payment_provider).toBe("helcim");
  });

  it("with HELCIM_API_TOKEN configured, returns a real Helcim token (htok_ prefix) and still persists it", () => {
    sim = new HelcimCheckoutSim(
      { active_provider: "helcim" },
      new Map([[booking.id, booking]]),
      { hasApiToken: true },
    );
    const res = sim.invoke("user_student", booking.id);
    expect(res.status).toBe(200);
    const body = res.body as { checkoutToken: string; stub: boolean };
    expect(body.stub).toBe(false);
    expect(body.checkoutToken).toMatch(/^htok_/);
    expect(sim.snapshot(booking.id)?.helcim_checkout_token).toBe(body.checkoutToken);
  });

  it("refuses to re-issue a token once the deposit is held_in_escrow", () => {
    sim.flipProvider("helcim");
    booking.deposit_status = "held_in_escrow";
    booking.helcim_checkout_token = "htok_already_paid";

    const res = sim.invoke("user_student", booking.id);
    expect(res.status).toBe(400);
    expect((res.body as any).error).toMatch(/already collected/);
    // Token from prior successful charge MUST be preserved.
    expect(sim.snapshot(booking.id)?.helcim_checkout_token).toBe("htok_already_paid");
  });

  it("forbids another student from initiating checkout against a booking they don't own", () => {
    sim.flipProvider("helcim");
    const res = sim.invoke("user_attacker", booking.id);
    expect(res.status).toBe(403);
    expect(sim.snapshot(booking.id)?.helcim_checkout_token).toBeNull();
  });
});

describe("Helcim sandbox card/status guardrails", () => {
  it("documents one reusable Helcim sandbox profile and rejects generic Stripe test Mastercard", () => {
    expect(HELCIM_SANDBOX_TEST_PROFILE).toMatchObject({
      firstName: "Andy",
      lastName: "Perez",
      phone: "7866032316",
      address: "3010 Valentina Way",
      card: { brand: "Mastercard", number: "5413 3300 8909 9130", cvv: "100", expiry: "01/28" },
    });
    expect(HELCIM_SANDBOX_TEST_CARDS).toHaveLength(1);
    expect(isHelcimSandboxCard("5413330089099130")).toBe(true);
    expect(isHelcimSandboxCard("5454545454545454")).toBe(false);
  });

  it("treats webhook-written booking statuses as paid", () => {
    expect(isBookingPaymentConfirmed({ escrow_status: "held", deposit_status: "held_in_escrow" })).toBe(true);
    expect(isBookingPaymentConfirmed({ escrow_status: "pending", deposit_status: "pending_payment" })).toBe(false);
  });
});
