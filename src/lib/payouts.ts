// Direct-handoff payout helpers.
// The 10% instructor deposit is sent directly student → instructor over
// Cash App / Venmo / PayPal / Zelle. We never touch the money — we just
// generate deep links and track confirmation in the bookings table.

import { supabase } from "@/integrations/supabase/client";

export type PayoutMethod = "cashapp" | "venmo" | "paypal" | "zelle";

export type PayoutHandle = {
  id: string;
  instructor_id: string;
  method_type: PayoutMethod;
  handle: string;
  is_preferred: boolean;
  created_at: string;
};

export type DepositStatus =
  | "not_required"
  | "pending_send"
  | "awaiting_confirmation"
  | "confirmed"
  | "expired";

export const PAYOUT_META: Record<
  PayoutMethod,
  {
    label: string;
    placeholder: string;
    hint: string;
    normalizeForDisplay: (h: string) => string;
    /** Returns a tap-to-pay deep link, or null if the platform doesn't support amount-prefilled links. */
    deepLink: (handle: string, amountCents: number, note: string) => string | null;
    validate: (v: string) => string | null;
  }
> = {
  cashapp: {
    label: "Cash App",
    placeholder: "$cashtag",
    hint: "Your $cashtag (e.g. $jane)",
    normalizeForDisplay: (h) => (h.startsWith("$") ? h : `$${h}`),
    deepLink: (h, cents) => {
      const tag = h.replace(/^\$/, "");
      return `https://cash.app/$${tag}/${(cents / 100).toFixed(2)}`;
    },
    validate: (v) =>
      /^\$?[A-Za-z][A-Za-z0-9_]{0,19}$/.test(v.trim())
        ? null
        : "Enter a valid $cashtag (letters/numbers/underscore)",
  },
  venmo: {
    label: "Venmo",
    placeholder: "@username",
    hint: "Your Venmo username",
    normalizeForDisplay: (h) => (h.startsWith("@") ? h : `@${h}`),
    deepLink: (h, cents, note) => {
      const u = h.replace(/^@/, "");
      const params = new URLSearchParams({
        txn: "pay",
        recipients: u,
        amount: (cents / 100).toFixed(2),
        note,
      });
      return `https://venmo.com/?${params.toString()}`;
    },
    validate: (v) =>
      /^@?[A-Za-z0-9_-]{5,30}$/.test(v.trim())
        ? null
        : "Enter a valid Venmo username (5–30 chars)",
  },
  paypal: {
    label: "PayPal",
    placeholder: "you@email.com or paypal.me/handle",
    hint: "Email or PayPal.me link",
    normalizeForDisplay: (h) => h,
    deepLink: (h, cents) => {
      const trimmed = h.trim();
      // PayPal.me handle (preferred)
      if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
        return `https://paypal.me/${trimmed}/${(cents / 100).toFixed(2)}USD`;
      }
      // Email — PayPal cannot prefill amounts via deep link
      return null;
    },
    validate: (v) => {
      const t = v.trim();
      if (/^[A-Za-z0-9_-]+$/.test(t)) return null;
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
      return "Enter a PayPal.me handle or your PayPal email";
    },
  },
  zelle: {
    label: "Zelle",
    placeholder: "email or phone enrolled with Zelle",
    hint: "Email or phone tied to your Zelle account",
    normalizeForDisplay: (h) => h,
    // Zelle has no public deep-link spec — student must open their bank app manually.
    deepLink: () => null,
    validate: (v) => {
      const t = v.trim();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
      if (/^\+?[0-9 ()-]{7,20}$/.test(t)) return null;
      return "Enter a valid email or phone";
    },
  },
};

export const fetchPayoutMethods = async (
  instructorId: string,
): Promise<PayoutHandle[]> => {
  const { data, error } = await supabase
    .from("instructor_payout_methods")
    .select("id, instructor_id, method_type, handle, is_preferred, created_at")
    .eq("instructor_id", instructorId)
    .order("is_preferred", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PayoutHandle[];
};
