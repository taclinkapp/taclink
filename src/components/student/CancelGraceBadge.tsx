import { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { cancelDeadline, formatCountdown } from '@/lib/cancellation';
import { cn } from '@/lib/utils';

type Props = {
  startsAt: string | Date | null;
  bookedAt: string | Date | null;
  cutoffHours?: number | null;
  variant?: 'inline' | 'card';
  className?: string;
};

/**
 * Shows the student's cancel-for-full-refund deadline derived from the
 * tiered grace period. Hidden once the deadline has passed.
 */
export const CancelGraceBadge = ({
  startsAt,
  bookedAt,
  cutoffHours,
  variant = 'inline',
  className,
}: Props) => {
  const deadline = cancelDeadline(startsAt, bookedAt, cutoffHours);
  const [, force] = useState(0);

  // Re-render every minute so the countdown stays accurate.
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [deadline?.getTime()]);

  if (!deadline) {
    if (variant === 'card') {
      return (
        <div
          className={cn(
            'tactical-card border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2',
            className,
          )}
        >
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">No grace period.</strong> Booked under 24h
            before the course — cancellations are not eligible for a full refund.
          </div>
        </div>
      );
    }
    return null;
  }

  const expired = deadline.getTime() <= Date.now();
  if (expired) return null;

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'tactical-card border-primary/30 bg-primary/5 p-3 flex items-start gap-2',
          className,
        )}
      >
        <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Cancel for a full refund by</strong>{' '}
          {deadline.toLocaleString([], {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}{' '}
          <span className="font-mono text-primary">({formatCountdown(deadline)})</span>.
        </div>
      </div>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-primary',
        className,
      )}
    >
      <Clock className="h-3 w-3" />
      {formatCountdown(deadline)} to cancel
    </span>
  );
};
