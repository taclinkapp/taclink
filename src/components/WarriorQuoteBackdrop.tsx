import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  pickQuote,
  useActiveWarriorQuotes,
  useWarriorQuoteSettings,
  type DisplayStyle,
} from '@/hooks/useWarriorQuotes';
import { X } from 'lucide-react';

type Audience = 'student' | 'instructor';

interface Props {
  audience: Audience;
}

/**
 * Renders the daily warrior/stoic quote in one of several styles.
 * Reads enabled / style / audience settings from the DB, so admins can flip it
 * on/off and change the display mode without a redeploy.
 */
export const WarriorQuoteBackdrop = ({ audience }: Props) => {
  const { settings, loaded: settingsLoaded } = useWarriorQuoteSettings();
  const { quotes, loaded: quotesLoaded } = useActiveWarriorQuotes();
  const [dismissed, setDismissed] = useState(false);

  const quote = useMemo(
    () => pickQuote(quotes, settings.rotation),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quotes, settings.rotation],
  );

  if (!settingsLoaded || !quotesLoaded) return null;
  if (!settings.enabled || !quote) return null;
  if (audience === 'student' && !settings.show_to_students) return null;
  if (audience === 'instructor' && !settings.show_to_instructors) return null;

  const style = settings.display_style as DisplayStyle;

  if (style === 'watermark') {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center px-8 select-none"
      >
        <div className="max-w-md text-center" style={{ opacity: settings.opacity }}>
          <p className="font-stencil text-2xl sm:text-3xl leading-snug italic text-foreground">
            “{quote.text}”
          </p>
          <p className="mt-3 text-[10px] uppercase tracking-[0.3em] text-foreground">
            — {quote.author}
          </p>
        </div>
      </div>
    );
  }

  if (style === 'banner') {
    return (
      <div className="px-4 pt-3">
        <div className="neu-sm px-4 py-3 flex items-start gap-3">
          <div className="text-primary text-lg leading-none mt-0.5">❝</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm italic text-foreground/90 leading-snug">{quote.text}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              — {quote.author}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (style === 'corner') {
    if (dismissed) return null;
    return (
      <div className="fixed bottom-24 right-3 z-30 max-w-[280px]">
        <div className="neu p-3 pr-7 relative">
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss quote"
            className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="text-xs italic text-foreground/90 leading-snug">“{quote.text}”</p>
          <p className="mt-1.5 text-[9px] uppercase tracking-[0.25em] text-primary font-bold">
            — {quote.author}
          </p>
        </div>
      </div>
    );
  }

  if (style === 'ticker') {
    return <Ticker text={quote.text} author={quote.author} />;
  }

  return null;
};

const Ticker = ({ text, author }: { text: string; author: string }) => {
  const [k, setK] = useState(0);
  // remount keyframes on text change so the marquee restarts cleanly
  useEffect(() => setK((n) => n + 1), [text]);
  const line = `${text}   —   ${author}`;
  return (
    <div className="sticky top-14 z-20 overflow-hidden border-y border-border bg-background/80 backdrop-blur">
      <div
        key={k}
        className="whitespace-nowrap py-1.5 text-[11px] tracking-[0.18em] uppercase text-muted-foreground"
        style={{ animation: 'wq-ticker 28s linear infinite' }}
      >
        <span className="px-8">{line}</span>
        <span className="px-8">{line}</span>
        <span className="px-8">{line}</span>
      </div>
      <style>{`@keyframes wq-ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
};

/** Convenience wrapper that picks audience from the auth context. */
export const WarriorQuoteForRole = () => {
  const { profile } = useAuth() as { profile?: { role?: string } | null };
  const role = profile?.role;
  if (role !== 'student' && role !== 'instructor') return null;
  return <WarriorQuoteBackdrop audience={role as Audience} />;
};
