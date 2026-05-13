import { useMemo } from 'react';
import { Quote } from 'lucide-react';
import {
  pickQuote,
  useActiveWarriorQuotes,
  useWarriorQuoteSettings,
} from '@/hooks/useWarriorQuotes';

type Audience = 'student' | 'instructor';

/**
 * Compact "Quote of the Day" pill designed to sit inline in a page header
 * (between the brand mark and trailing actions like the notifications bell).
 * Renders nothing if quotes are disabled or hidden for the audience.
 */
export const InlineQuoteOfDay = ({ audience }: { audience: Audience }) => {
  const { settings, loaded: sLoaded } = useWarriorQuoteSettings();
  const { quotes, loaded: qLoaded } = useActiveWarriorQuotes();

  const quote = useMemo(
    () => pickQuote(quotes, settings.rotation),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quotes, settings.rotation],
  );

  if (!sLoaded || !qLoaded) return null;
  if (!settings.enabled || !quote) return null;
  if (audience === 'student' && !settings.show_to_students) return null;
  if (audience === 'instructor' && !settings.show_to_instructors) return null;

  return (
    <div
      className="mx-2 flex-1 min-w-0 flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5"
      title={`“${quote.text}” — ${quote.author}`}
    >
      <Quote className="h-3.5 w-3.5 text-primary shrink-0" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[10px] uppercase tracking-[0.2em] text-primary/80 font-bold truncate">
          Quote of the day
        </p>
        <p className="text-[11px] italic text-foreground/90 truncate">
          “{quote.text}” <span className="not-italic text-muted-foreground">— {quote.author}</span>
        </p>
      </div>
    </div>
  );
};
