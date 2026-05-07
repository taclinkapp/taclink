import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PillarId } from "@/lib/pillars";

export type AreaAnalytics = {
  loading: boolean;
  located: boolean;
  locationError: string | null;
  radiusMiles: number;
  totalInArea: number;
  matchingPillars: number;
  nearestMiles: number | null;
  soonestStartAt: string | null;
  avgPriceCents: number | null;
  topCity: { city: string; count: number } | null;
  instructorsInArea: number;
};

const MILES_PER_KM = 0.621371;

function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371; // km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) * MILES_PER_KM;
}

type Row = {
  id: string;
  primary_pillar: PillarId | null;
  secondary_pillar: PillarId | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  starts_at: string | null;
  price_cents: number | null;
  instructor_id: string;
};

/**
 * Real-time area analytics: pulls all published courses, geo-filters by the
 * user's current location + travel radius, and surfaces useful stats for
 * onboarding (counts, nearest, soonest, average price, top city).
 *
 * Falls back to nationwide stats when geolocation is unavailable/denied.
 */
export function useAreaCourseAnalytics(opts: {
  pillars: PillarId[];
  radiusMiles: number;
}): AreaAnalytics {
  const { pillars, radiusMiles } = opts;
  const [state, setState] = useState<AreaAnalytics>({
    loading: true,
    located: false,
    locationError: null,
    radiusMiles,
    totalInArea: 0,
    matchingPillars: 0,
    nearestMiles: null,
    soonestStartAt: null,
    avgPriceCents: null,
    topCity: null,
    instructorsInArea: 0,
  });

  useEffect(() => {
    let cancelled = false;

    const getLocation = () =>
      new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
          resolve(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 8000 },
        );
      });

    (async () => {
      const here = await getLocation();
      const { data, error } = await supabase
        .from("courses")
        .select(
          "id, primary_pillar, secondary_pillar, lat, lng, city, starts_at, price_cents, instructor_id",
        )
        .eq("status", "published")
        .limit(1000);

      if (cancelled) return;
      if (error || !data) {
        setState((s) => ({ ...s, loading: false, locationError: error?.message ?? null }));
        return;
      }

      const rows = data as Row[];
      const pillarSet = new Set(pillars);

      const inArea = here
        ? rows.filter(
            (r) =>
              r.lat != null &&
              r.lng != null &&
              haversineMiles(here, { lat: r.lat, lng: r.lng }) <= radiusMiles,
          )
        : rows;

      const matching = pillarSet.size
        ? inArea.filter(
            (r) =>
              (r.primary_pillar && pillarSet.has(r.primary_pillar)) ||
              (r.secondary_pillar && pillarSet.has(r.secondary_pillar)),
          )
        : inArea;

      const nearestMiles = here
        ? matching.reduce<number | null>((min, r) => {
            if (r.lat == null || r.lng == null) return min;
            const d = haversineMiles(here, { lat: r.lat, lng: r.lng });
            return min == null || d < min ? d : min;
          }, null)
        : null;

      const now = Date.now();
      const soonestStartAt =
        matching
          .map((r) => r.starts_at)
          .filter((s): s is string => !!s && new Date(s).getTime() > now)
          .sort()[0] ?? null;

      const prices = matching
        .map((r) => r.price_cents ?? 0)
        .filter((p) => p > 0);
      const avgPriceCents = prices.length
        ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
        : null;

      const cityCounts = new Map<string, number>();
      for (const r of matching) {
        if (!r.city) continue;
        cityCounts.set(r.city, (cityCounts.get(r.city) ?? 0) + 1);
      }
      const topCity =
        [...cityCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([city, count]) => ({ city, count }))[0] ?? null;

      const instructorsInArea = new Set(matching.map((r) => r.instructor_id))
        .size;

      setState({
        loading: false,
        located: !!here,
        locationError: here ? null : "Location unavailable — showing nationwide stats",
        radiusMiles,
        totalInArea: inArea.length,
        matchingPillars: matching.length,
        nearestMiles,
        soonestStartAt,
        avgPriceCents,
        topCity,
        instructorsInArea,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [pillars.join(","), radiusMiles]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
