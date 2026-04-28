/**
 * Anti-bypass contact-info detection & redaction.
 *
 * Used both client-side (to block submission early) and server-side
 * (the redact-contact-info edge function imports the same patterns).
 *
 * Patterns intentionally err on the side of catching obfuscation
 * attempts (spelled-out "dot com", "at gmail", etc.).
 */

export type DetectedKind =
  | 'phone'
  | 'email'
  | 'social_handle'
  | 'url'
  | 'payment_app'
  | 'obfuscated';

export interface Detection {
  kind: DetectedKind;
  match: string;
  index: number;
}

const REDACTION_TEXT = '[Contact info removed — all transactions must go through TacLink]';

// --- Patterns ---------------------------------------------------------------

// Phone: 7+ digit sequences with common separators, with optional country code.
// Catches: 555-123-4567, (555) 123-4567, 555.123.4567, +1 555 123 4567, 5551234567
const PHONE_RE =
  /(?:(?:\+?\d{1,3}[\s.\-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.\-]?\d{2,4}[\s.\-]?\d{2,5})/g;

// Email: standard local@domain with TLD, also catches "name (at) domain dot com" style
const EMAIL_RE = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi;

const OBFUSCATED_EMAIL_RE =
  /\b[a-z0-9._%+\-]{2,}\s*(?:\(?(?:at|@)\)?)\s*[a-z0-9.\-]{2,}\s*(?:\(?(?:dot|\.)\)?)\s*[a-z]{2,}\b/gi;

// URL: http(s)://, www., or bare domain.tld
const URL_RE =
  /\b((?:https?:\/\/|www\.)[^\s<>()]+|\b[a-z0-9-]+\.(?:com|net|org|io|co|app|dev|me|tv|gg|xyz|info|us)(?:\/[^\s]*)?)\b/gi;

// Social handles: @username (3-30 chars), excluding email pattern
const SOCIAL_HANDLE_RE = /(?<![a-z0-9._%+\-])@([a-z0-9_.]{3,30})\b/gi;

// Payment apps & off-platform payment phrases
const PAYMENT_APP_RE =
  /\b(venmo|cash\s*app|cashapp|zelle|paypal(?:\.me)?|apple\s*pay|google\s*pay|wire\s*transfer|western\s*union)\b/gi;

const PAYMENT_PHRASE_RE =
  /\b(?:pay\s+(?:me|cash|in\s*cash)|cash\s+only|off\s*the\s*app|outside\s+the\s+app|off[\s-]platform|skip\s+the\s+fee|avoid\s+the\s+fee)\b/gi;

// Spelled-out digit sequences (e.g. "five five five one two three four five six seven")
const SPELLED_DIGITS_RE =
  /\b(?:zero|one|two|three|four|five|six|seven|eight|nine)(?:[\s,.\-]+(?:zero|one|two|three|four|five|six|seven|eight|nine)){6,}/gi;

const ALL_PATTERNS: Array<{ re: RegExp; kind: DetectedKind }> = [
  { re: EMAIL_RE, kind: 'email' },
  { re: OBFUSCATED_EMAIL_RE, kind: 'obfuscated' },
  { re: URL_RE, kind: 'url' },
  { re: SOCIAL_HANDLE_RE, kind: 'social_handle' },
  { re: PAYMENT_APP_RE, kind: 'payment_app' },
  { re: PAYMENT_PHRASE_RE, kind: 'payment_app' },
  { re: SPELLED_DIGITS_RE, kind: 'obfuscated' },
  { re: PHONE_RE, kind: 'phone' },
];

// --- Public API -------------------------------------------------------------

export const detectContactInfo = (input: string): Detection[] => {
  if (!input) return [];
  const detections: Detection[] = [];
  for (const { re, kind } of ALL_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      detections.push({ kind, match: m[0], index: m.index });
      if (m[0].length === 0) re.lastIndex++; // safety
    }
  }
  return detections;
};

export const hasContactInfo = (input: string): boolean =>
  detectContactInfo(input).length > 0;

export const redactContactInfo = (input: string): { redacted: string; detections: Detection[] } => {
  const detections = detectContactInfo(input);
  if (detections.length === 0) return { redacted: input, detections };
  let redacted = input;
  for (const { re } of ALL_PATTERNS) {
    re.lastIndex = 0;
    redacted = redacted.replace(re, REDACTION_TEXT);
  }
  return { redacted, detections };
};

export const summarizeDetections = (detections: Detection[]): string => {
  if (detections.length === 0) return '';
  const kinds = Array.from(new Set(detections.map((d) => d.kind)));
  return kinds.join(', ');
};

export const CONTACT_REDACTION_MESSAGE = REDACTION_TEXT;
export const CONTACT_VIOLATION_USER_MESSAGE =
  'Contact information is not allowed. All bookings must go through TacLink.';
