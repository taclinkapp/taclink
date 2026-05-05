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

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query,
    )}.json?access_token=${token}&limit=1&types=address,place,locality,postcode`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("[geocode] HTTP error", res.status);
      return null;
    }
    const data = (await res.json()) as {
      features?: Array<{ center: [number, number]; place_name?: string }>;
    };
    const feat = data.features?.[0];
    if (!feat) return null;
    const [lng, lat] = feat.center;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, matchedPlace: feat.place_name };
  } catch (e) {
    console.error("[geocode] failed", e);
    return null;
  }
};
