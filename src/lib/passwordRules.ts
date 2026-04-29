// Password creation rules used across signup flows.
// Keep server-side parity in mind: Supabase will also reject weak passwords
// when leaked-password protection is enabled.

export type PasswordRule = {
  id: string;
  label: string;
  test: (pw: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'One uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'One lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'One number (0–9)', test: (p) => /[0-9]/.test(p) },
  { id: 'symbol', label: 'One symbol (!@#$…)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function validatePassword(pw: string): { valid: boolean; failed: PasswordRule[] } {
  const failed = PASSWORD_RULES.filter((r) => !r.test(pw));
  return { valid: failed.length === 0, failed };
}

export function passwordStrength(pw: string): { score: number; label: string } {
  const passed = PASSWORD_RULES.filter((r) => r.test(pw)).length;
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  return { score: passed, label: labels[passed] ?? 'Too weak' };
}
