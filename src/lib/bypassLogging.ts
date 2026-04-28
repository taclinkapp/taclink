import { supabase } from '@/integrations/supabase/client';
import {
  detectContactInfo,
  type Detection,
  summarizeDetections,
} from '@/lib/contactRedaction';

type LogArgs = {
  userId?: string | null;
  userRole?: string | null;
  fieldName: string;
  originalContent: string;
  detections: Detection[];
  actionTaken: 'redacted' | 'blocked' | 'warned';
  context?: Record<string, unknown>;
};

/**
 * Best-effort log of a bypass attempt. Errors are swallowed — we never want
 * to break a user flow just because logging failed.
 */
export const logBypassAttempt = async ({
  userId,
  userRole,
  fieldName,
  originalContent,
  detections,
  actionTaken,
  context,
}: LogArgs) => {
  try {
    await (supabase as any).from('bypass_attempts').insert({
      user_id: userId ?? null,
      user_role: userRole ?? null,
      field_name: fieldName,
      original_content: originalContent.slice(0, 4000),
      detected_pattern: summarizeDetections(detections) || 'unknown',
      action_taken: actionTaken,
      context: context ?? null,
    });
  } catch (e) {
    console.warn('Failed to log bypass attempt', e);
  }
};

/**
 * Validate user input client-side. Returns null if clean,
 * or { detections, message } if contact info is present.
 */
export const validateNoContactInfo = (input: string) => {
  const detections = detectContactInfo(input);
  if (detections.length === 0) return null;
  return {
    detections,
    message:
      'Contact information is not allowed. Please remove phone numbers, emails, social handles, links, or payment-app references.',
  };
};
