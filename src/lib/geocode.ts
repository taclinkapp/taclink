import { supabase } from "@/integrations/supabase/client";

/**
 * Forward-geocode a freeform address using Mapbox's Geocoding API.
 * Returns null if no result is found or geocoding fails.
 *
 * Mapbox token is fetched via the same edge function the map uses, so we
 * never expose it to the page bundle.
 */
let cachedToken: string | null = null;

const getMapboxToken = async (): Promise<string | null> => {
  if (cachedToken) return cachedToken;
  try {
    const { data, error } = await supabase.functions.invoke("get-mapbox-token");
    if (error) throw error;
    const t = (data as { token?: string })?.token ?? null;
    if (t) cachedToken = t;
    return t;
  } catch (e) {
    console.error("[geocode] failed to fetch mapbox token", e);
    return null;
  }
};

export type GeocodeResult = {
  lat: number;
  lng: number;
  matchedPlace?: string;
};

// Common US state name <-> 2-letter code lookup for region matching.
const US_STATES: Record<string, string> = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california",
  CO: "colorado", CT: "connecticut", DE: "delaware", FL: "florida", GA: "georgia",
  HI: "hawaii", ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa",
  KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland",
  MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi",
  MO: "missouri", MT: "montana", NE: "nebraska", NV: "nevada", NH: "new hampshire",
  NJ: "new jersey", NM: "new mexico", NY: "new york", NC: "north carolina",
  ND: "north dakota", OH: "ohio", OK: "oklahoma", OR: "oregon", PA: "pennsylvania",
  RI: "rhode island", SC: "south carolina", SD: "south dakota", TN: "tennessee",
  TX: "texas", UT: "utah", VT: "vermont", VA: "virginia", WA: "washington",
  WV: "west virginia", WI: "wisconsin", WY: "wyoming", DC: "district of columbia",
};

const normalizeState = (s: string | null | undefined): { code: string; name: string } | null => {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  const up = t.toUpperCase();
  if (US_STATES[up]) return { code: up, name: US_STATES[up] };
  const entry = Object.entries(US_STATES).find(([, name]) => name === t.toLowerCase());
  return entry ? { code: entry[0], name: entry[1] } : null;
};

// Verify a Mapbox feature actually sits inside the requested city/state.
// Without this, a typo in the street address can silently snap a course pin
// to a wildly wrong place (e.g. Fayetteville NC -> Modesto CA).
const featureMatchesRegion = (
  feature: { place_name?: string; context?: Array<{ id?: string; text?: string; short_code?: string }> } | undefined,
  city: string | null | undefined,
  state: string | null | undefined,
): boolean => {
  if (!feature) return false;
  const ctx = feature.context ?? [];
  const place = (feature.place_name ?? "").toLowerCase();

  const st = normalizeState(state);
  if (st) {
    const region = ctx.find((c) => (c.id ?? "").startsWith("region"));
    const shortCode = (region?.short_code ?? "").toUpperCase().replace(/^US-/, "");
    const regionText = (region?.text ?? "").toLowerCase();
    const stateOk =
      shortCode === st.code ||
      regionText === st.name ||
      place.includes(`, ${st.code.toLowerCase()} `) ||
      place.includes(`, ${st.code} `) ||
      place.includes(st.name);
    if (!stateOk) return false;
  }

  if (city && city.trim()) {
    const target = city.trim().toLowerCase();
    const placeCtx = ctx.find((c) => (c.id ?? "").startsWith("place"));
    const placeText = (placeCtx?.text ?? "").toLowerCase();
    const cityOk = placeText === target || place.includes(target);
    if (!cityOk) return false;
  }
  return true;
};

export const geocodeAddress = async (parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}): Promise<GeocodeResult | null> => {
  const query = [parts.address, parts.city, parts.state, parts.country ?? "USA"]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(", ");
  if (!query) return null;

  const token = await getMapboxToken();
  if (!token) return null;

  const fetchFeatures = async (q: string) => {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      q,
    )}.json?access_token=${token}&limit=5&country=us&types=address,place,locality,postcode`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("[geocode] HTTP error", res.status);
      return [] as Array<{
        center: [number, number];
        place_name?: string;
        context?: Array<{ id?: string; text?: string; short_code?: string }>;
      }>;
    }
    const data = (await res.json()) as {
      features?: Array<{
        center: [number, number];
        place_name?: string;
        context?: Array<{ id?: string; text?: string; short_code?: string }>;
      }>;
    };
    return data.features ?? [];
  };

  try {
    // Try the full address first, then fall back to city+state if no candidate
    // matches the requested region. This prevents typos in the street line
    // from snapping the pin to the wrong state.
    let features = await fetchFeatures(query);
    let feat = features.find((f) => featureMatchesRegion(f, parts.city, parts.state));
    if (!feat) {
      const fallbackQuery = [parts.city, parts.state, parts.country ?? "USA"]
        .map((s) => (s || "").trim())
        .filter(Boolean)
        .join(", ");
      if (fallbackQuery && fallbackQuery !== query) {
        features = await fetchFeatures(fallbackQuery);
        feat = features.find((f) => featureMatchesRegion(f, parts.city, parts.state));
      }
    }
    if (!feat) return null;
    const [lng, lat] = feat.center;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, matchedPlace: feat.place_name };
  } catch (e) {
    console.error("[geocode] failed", e);
    return null;
  }
};

