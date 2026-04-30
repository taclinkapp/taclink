import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Reads the two pre-launch settings from `platform_settings`:
 *  - `prelaunch_mode` (boolean): when true, instructors can browse + draft
 *    courses but cannot publish, and the monthly subscription page is hidden.
 *  - `launch_date` (ISO date string): drives the public countdown clock.
 *
 * Falls back to safe defaults when the rows are missing so the UI never crashes.
 */
export type PrelaunchConfig = {
  enabled: boolean;
  launchDateIso: string | null;
};

const FALLBACK_LAUNCH_ISO = '2026-07-04T12:00:00Z';

export const usePrelaunch = () => {
  return useQuery<PrelaunchConfig>({
    queryKey: ['prelaunch_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key,value')
        .in('key', ['prelaunch_mode', 'launch_date']);
      if (error) {
        return { enabled: false, launchDateIso: FALLBACK_LAUNCH_ISO };
      }
      const map = new Map((data ?? []).map((r: any) => [r.key, r.value]));
      const rawMode = map.get('prelaunch_mode');
      const rawDate = map.get('launch_date');
      const enabled = rawMode === true || rawMode === 'true';
      let launchDateIso: string | null = null;
      if (typeof rawDate === 'string' && rawDate.length > 0) {
        // jsonb may store either "2026-06-01" or full ISO. Normalize.
        launchDateIso = rawDate.length === 10 ? `${rawDate}T12:00:00Z` : rawDate;
      }
      return {
        enabled,
        launchDateIso: launchDateIso ?? FALLBACK_LAUNCH_ISO,
      };
    },
    staleTime: 60_000,
  });
};
