import { AlertTriangle } from 'lucide-react';
import { detectContactInfo, type Detection } from '@/lib/contactRedaction';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  className?: string;
  /** Override the default warning message */
  message?: string;
}

/**
 * Inline warning shown beneath a text input when the user types
 * disallowed contact info. Pure presentational — pair with
 * `useContactInfoCheck` or a manual `detectContactInfo` call.
 */
export const ContactInfoWarning = ({ value, className, message }: Props) => {
  const detections: Detection[] = detectContactInfo(value);
  if (detections.length === 0) return null;
  const kinds = Array.from(new Set(detections.map((d) => d.kind))).join(', ');
  return (
    <div
      role="alert"
      className={cn(
        'mt-1.5 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive',
        className,
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
      <div>
        <div className="font-bold">
          {message ?? 'Contact information is not allowed.'}
        </div>
        <div className="text-destructive/80 mt-0.5">
          All bookings must go through TacLink. Detected: {kinds}.
        </div>
      </div>
    </div>
  );
};
