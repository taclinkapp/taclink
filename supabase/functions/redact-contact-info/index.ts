// supabase/functions/redact-contact-info/index.ts
//
// Detects and redacts contact information / off-platform payment references
// in user-submitted text. Used by:
//   - the messaging UI before storing a chat message
//   - the instructor flows for bio / course descriptions
//
// Returns:
//   {
//     clean: boolean,                 // true if no contact info detected
//     redacted: string,                // input with all matches replaced
//     detections: { kind, match }[]    // what was caught
//   }

import { corsHeaders } from 'npm:@supabase/supabase-js@2.95.0/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { z } from 'npm:zod@3.23.8';

const REDACTION_TEXT =
  '[Contact info removed — all transactions must go through TacLink]';

type DetectedKind =
  | 'phone'
  | 'email'
  | 'social_handle'
  | 'url'
  | 'payment_app'
  | 'obfuscated';

const PHONE_RE =
  /(?:(?:\+?\d{1,3}[\s.\-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.\-]?\d{2,4}[\s.\-]?\d{2,5})/g;
const EMAIL_RE = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi;
const OBFUSCATED_EMAIL_RE =
  /\b[a-z0-9._%+\-]{2,}\s*(?:\(?(?:at|@)\)?)\s*[a-z0-9.\-]{2,}\s*(?:\(?(?:dot|\.)\)?)\s*[a-z]{2,}\b/gi;
const URL_RE =
  /\b((?:https?:\/\/|www\.)[^\s<>()]+|\b[a-z0-9-]+\.(?:com|net|org|io|co|app|dev|me|tv|gg|xyz|info|us)(?:\/[^\s]*)?)\b/gi;
const SOCIAL_HANDLE_RE = /(?<![a-z0-9._%+\-])@([a-z0-9_.]{3,30})\b/gi;
const PAYMENT_APP_RE =
  /\b(venmo|cash\s*app|cashapp|zelle|paypal(?:\.me)?|apple\s*pay|google\s*pay|wire\s*transfer|western\s*union)\b/gi;
const PAYMENT_PHRASE_RE =
  /\b(?:pay\s+(?:me|cash|in\s*cash)|cash\s+only|off\s*the\s*app|outside\s+the\s+app|off[\s-]platform|skip\s+the\s+fee|avoid\s+the\s+fee)\b/gi;
const SPELLED_DIGITS_RE =
  /\b(?:zero|one|two|three|four|five|six|seven|eight|nine)(?:[\s,.\-]+(?:zero|one|two|three|four|five|six|seven|eight|nine)){6,}/gi;

const PATTERNS: Array<{ re: RegExp; kind: DetectedKind }> = [
  { re: EMAIL_RE, kind: 'email' },
  { re: OBFUSCATED_EMAIL_RE, kind: 'obfuscated' },
  { re: URL_RE, kind: 'url' },
  { re: SOCIAL_HANDLE_RE, kind: 'social_handle' },
  { re: PAYMENT_APP_RE, kind: 'payment_app' },
  { re: PAYMENT_PHRASE_RE, kind: 'payment_app' },
  { re: SPELLED_DIGITS_RE, kind: 'obfuscated' },
  { re: PHONE_RE, kind: 'phone' },
];

const detect = (input: string) => {
  const out: { kind: DetectedKind; match: string }[] = [];
  for (const { re, kind } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      out.push({ kind, match: m[0] });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return out;
};

const redactAll = (input: string) => {
  let out = input;
  for (const { re } of PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, REDACTION_TEXT);
  }
  return out;
};

const BodySchema = z.object({
  text: z.string().min(1).max(10000),
  field_name: z.string().min(1).max(100).default('unknown'),
  log_attempt: z.boolean().default(true),
  context: z.record(z.unknown()).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Try to identify the caller (optional — endpoint is callable anonymously
    // because some flows like signup may not yet be authenticated).
    let userId: string | null = null;
    let userRole: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace('Bearer ', '');
      const { data } = await supa.auth.getClaims(token);
      if (data?.claims) {
        userId = data.claims.sub as string;
        userRole = (data.claims.user_metadata as any)?.role ?? null;
      }
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { text, field_name, log_attempt, context } = parsed.data;
    const detections = detect(text);
    const clean = detections.length === 0;
    const redacted = clean ? text : redactAll(text);

    if (!clean && log_attempt) {
      // Use service role to insert so logging works even for anon callers.
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const kinds = Array.from(new Set(detections.map((d) => d.kind)));
      await admin.from('bypass_attempts').insert({
        user_id: userId,
        user_role: userRole,
        field_name,
        original_content: text.slice(0, 4000),
        redacted_content: redacted.slice(0, 4000),
        detected_pattern: kinds.join(', '),
        action_taken: 'blocked',
        context: context ?? null,
      });
    }

    return new Response(
      JSON.stringify({ clean, redacted, detections }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('redact-contact-info error', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
