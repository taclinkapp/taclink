import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  /** Number of strike points to add. Defaults to 1 per logged attempt. */
  strikePoints?: number;
};

export type StrikeResult = {
  newPoints: number;
  newStatus: 'active' | 'warned' | 'suspended';
  warningIssued: boolean;
  suspended: boolean;
} | null;

const showStrikeFeedback = (result: StrikeResult) => {
  if (!result) return;
  if (result.suspended) {
    toast.error(
      `Account suspended (${result.newPoints} strikes). Contact support to appeal.`,
      { duration: 10_000 },
    );
  } else if (result.warningIssued) {
    toast.warning(
      `Final warning (${result.newPoints}/4 strikes). One more violation will suspend your account.`,
      { duration: 8_000 },
    );
  } else if (result.newPoints > 0) {
    toast.warning(
      `Strike recorded (${result.newPoints}/4). Repeated violations will suspend your account.`,
    );
  }
};

/**
 * Best-effort log of a bypass attempt. Errors are swallowed — we never want
 * to break a user flow just because logging failed. When a userId is provided,
 * also award strike points and surface a warning/suspension toast.
 */
export const logBypassAttempt = async ({
  userId,
  userRole,
  fieldName,
  originalContent,
  detections,
  actionTaken,
  context,
  strikePoints = 1,
}: LogArgs): Promise<StrikeResult> => {
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

  if (!userId || strikePoints <= 0) return null;

  try {
    const { data, error } = await (supabase as any).rpc('award_strike', {
      _user_id: userId,
      _points: strikePoints,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    const result: StrikeResult = {
      newPoints: row.new_points,
      newStatus: row.new_status,
      warningIssued: !!row.warning_issued,
      suspended: !!row.suspended,
    };
    showStrikeFeedback(result);
    return result;
  } catch (e) {
    console.warn('Failed to award strike', e);
    return null;
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
