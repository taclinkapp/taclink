import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type WarriorQuoteRow = {
  id: string;
  text: string;
  author: string;
  source_note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DisplayStyle = 'watermark' | 'banner' | 'corner' | 'ticker';
export type Rotation = 'daily' | 'hourly' | 'per_visit';

export type WarriorQuoteSettings = {
  enabled: boolean;
  display_style: DisplayStyle;
  opacity: number;
  show_to_students: boolean;
  show_to_instructors: boolean;
  rotation: Rotation;
};

const DEFAULT_SETTINGS: WarriorQuoteSettings = {
  enabled: true,
  display_style: 'watermark',
  opacity: 0.06,
  show_to_students: true,
  show_to_instructors: true,
  rotation: 'daily',
};

/**
 * Pick a quote deterministically based on rotation mode. Returns the same
 * quote for everyone in the same rotation window, so users on the same day
 * see the same quote on watermarks/banners.
 */
export const pickQuote = (
  quotes: Pick<WarriorQuoteRow, 'id' | 'text' | 'author'>[],
  rotation: Rotation,
  now: Date = new Date(),
): { text: string; author: string } | null => {
  if (!quotes.length) return null;
  let bucket: number;
  if (rotation === 'hourly') {
    bucket = Math.floor(now.getTime() / 3_600_000);
  } else if (rotation === 'per_visit') {
    bucket = Math.floor(Math.random() * quotes.length);
  } else {
    const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    bucket = Math.floor(utc / 86_400_000);
  }
  const q = quotes[Math.abs(bucket) % quotes.length];
  return { text: q.text, author: q.author };
};

export const useWarriorQuoteSettings = () => {
  const [settings, setSettings] = useState<WarriorQuoteSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('warrior_quote_settings')
      .select('enabled, display_style, opacity, show_to_students, show_to_instructors, rotation')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) setSettings({ ...DEFAULT_SETTINGS, ...(data as Partial<WarriorQuoteSettings>) });
        setLoaded(true);
      });

    const channel = supabase
      .channel('warrior-quote-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warrior_quote_settings' }, (payload) => {
        const next = (payload.new ?? payload.old) as Partial<WarriorQuoteSettings>;
        if (next) setSettings((s) => ({ ...s, ...next }));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { settings, loaded };
};

export const useActiveWarriorQuotes = () => {
  const [quotes, setQuotes] = useState<Pick<WarriorQuoteRow, 'id' | 'text' | 'author'>[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('warrior_quotes')
      .select('id, text, author')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setQuotes(data ?? []);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  return { quotes, loaded };
};
