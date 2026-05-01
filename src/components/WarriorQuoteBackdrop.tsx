import { useMemo } from 'react';
import { getDailyQuote } from '@/lib/warriorQuotes';

/**
 * Subtle, non-interactive watermark of the daily warrior/stoic quote.
 * Sits behind the page content and rotates once per UTC day.
 */
export const WarriorQuoteBackdrop = () => {
  const quote = useMemo(() => getDailyQuote(), []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center px-8 select-none"
    >
      <div className="max-w-md text-center">
        <p className="font-stencil text-2xl sm:text-3xl leading-snug italic text-foreground/[0.06]">
          “{quote.text}”
        </p>
        <p className="mt-3 text-[10px] uppercase tracking-[0.3em] text-foreground/[0.08]">
          — {quote.author}
        </p>
      </div>
    </div>
  );
};
