import { z } from "zod";

export type AltPayoutType = "cashapp" | "venmo" | "paypal" | "zelle";

export const ALT_PAYOUT_META: Record<
  AltPayoutType,
  { label: string; placeholder: string; hint: string; validate: (v: string) => string | null; normalize: (v: string) => string }
> = {
  cashapp: {
    label: "Cash App",
    placeholder: "$cashtag",
    hint: "Your $cashtag (e.g. $jane) — 1–20 letters/numbers/underscore",
    validate: (v) =>
      /^\$?[A-Za-z][A-Za-z0-9_]{0,19}$/.test(v.trim())
        ? null
        : "Enter a valid $cashtag (1–20 chars, must start with a letter)",
    normalize: (v) => {
      const t = v.trim();
      return t.startsWith("$") ? t : `$${t}`;
    },
  },
  venmo: {
    label: "Venmo",
    placeholder: "@username",
    hint: "Your Venmo username — 5–30 letters, numbers, hyphens or underscores",
    validate: (v) =>
      /^@?[A-Za-z0-9_-]{5,30}$/.test(v.trim())
        ? null
        : "Enter a valid Venmo username (5–30 chars)",
    normalize: (v) => {
      const t = v.trim();
      return t.startsWith("@") ? t : `@${t}`;
    },
  },
  paypal: {
    label: "PayPal",
    placeholder: "you@email.com",
    hint: "Email tied to your PayPal account",
    validate: (v) =>
      z.string().email().max(254).safeParse(v.trim()).success
        ? null
        : "Enter a valid PayPal email address",
    normalize: (v) => v.trim().toLowerCase(),
  },
  zelle: {
    label: "Zelle",
    placeholder: "email or phone",
    hint: "Email or phone number enrolled with Zelle",
    validate: (v) => {
      const t = v.trim();
      if (z.string().email().max(254).safeParse(t).success) return null;
      const digits = t.replace(/\D/g, "");
      if (/^\+?[0-9 ()-]{7,20}$/.test(t) && digits.length >= 7 && digits.length <= 15) return null;
      return "Enter a valid email or US-format phone number";
    },
    normalize: (v) => {
      const t = v.trim();
      if (t.includes("@")) return t.toLowerCase();
      return t.replace(/\s+/g, "");
    },
  },
};

export const validatePayoutHandle = (type: AltPayoutType, value: string) =>
  ALT_PAYOUT_META[type].validate(value);

export const normalizePayoutHandle = (type: AltPayoutType, value: string) =>
  ALT_PAYOUT_META[type].normalize(value);
