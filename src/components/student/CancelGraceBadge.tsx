import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, ChevronDown } from 'lucide-react';
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
 * tiered grace period. The `card` variant renders a compact red collapsible
 * row (closed by default) so the verbose policy text doesn't dominate the
 * booking views — the details remain one tap away.
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
  const [open, setOpen] = useState(false);

  // Re-render every minute so the countdown stays accurate.
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [deadline?.getTime()]);

  // No grace window — collapsible red notice for the card variant.
  if (!deadline) {
    if (variant === 'card') {
      return (
        <div
          className={cn(
            'tactical-card border-destructive/40 bg-destructive/5 overflow-hidden',
            className,
          )}
        >
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left"
          >
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-destructive flex-1">
              Cancel course · no refund window
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-destructive transition-transform',
                open && 'rotate-180',
              )}
            />
          </button>
          {open && (
            <div className="px-3 pb-3 text-xs text-muted-foreground leading-relaxed border-t border-destructive/20 pt-2">
              <strong className="text-foreground">No grace period.</strong> Booked under 24h
              before the course — cancellations are not eligible for a full refund.
            </div>
          )}
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
          'tactical-card border-destructive/40 bg-destructive/5 overflow-hidden',
          className,
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left"
        >
          <Clock className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-destructive flex-1">
            Cancel course · {formatCountdown(deadline)}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-destructive transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
        {open && (
          <div className="px-3 pb-3 text-xs text-muted-foreground leading-relaxed border-t border-destructive/20 pt-2">
            <strong className="text-foreground">Cancel for a 100% refund ($25 + full course price) by</strong>{' '}
            {deadline.toLocaleString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
            . After this, you'll receive 90% of the course price back; instructor keeps 10%; $25 fee non-refundable after the grace window.
          </div>
        )}
      </div>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-destructive',
        className,
      )}
    >
      <Clock className="h-3 w-3" />
      {formatCountdown(deadline)} to cancel
    </span>
  );
};
