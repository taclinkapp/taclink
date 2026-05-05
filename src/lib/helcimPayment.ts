export const HELCIM_SANDBOX_TEST_CARDS = [
  { brand: "Visa", number: "4124 9399 9999 9990", cvv: "100", expiry: "01/28" },
  { brand: "Mastercard", number: "5413 3300 8909 9130", cvv: "100", expiry: "01/28" },
  { brand: "Mastercard", number: "5413 3300 8902 0011", cvv: "100", expiry: "01/28" },
  { brand: "Amex", number: "3742 4500 1751 006", cvv: "1000", expiry: "01/28" },
] as const;

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