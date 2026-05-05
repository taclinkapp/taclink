export const HELCIM_SANDBOX_TEST_PROFILE = {
  firstName: "Andy",
  lastName: "Perez",
  fullName: "Andy Perez",
  phone: "7866032316",
  address: "3010 Valentina Way",
  zip: "90210",
  card: {
    brand: "Mastercard",
    number: "5413 3300 8909 9130",
    cvv: "100",
    expiry: "01/28",
  },
} as const;

export const HELCIM_SANDBOX_TEST_CARDS = [HELCIM_SANDBOX_TEST_PROFILE.card] as const;

export function normalizeCardNumber(cardNumber: string) {
  return cardNumber.replace(/\D/g, "");
}

export function isHelcimSandboxCard(cardNumber: string) {
  const normalized = normalizeCardNumber(cardNumber);
  return HELCIM_SANDBOX_TEST_CARDS.some((card) => normalizeCardNumber(card.number) === normalized);
}

export function isBookingPaymentConfirmed(row: {
  escrow_status?: string | null;
  deposit_status?: string | null;
}) {
  return (
    row.escrow_status === "held" ||
    row.escrow_status === "released" ||
    row.deposit_status === "held_in_escrow" ||
    row.deposit_status === "confirmed"
  );
}