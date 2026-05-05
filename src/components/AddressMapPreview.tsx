import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { MapPin, Loader2 } from "lucide-react";

type Props = {
  address?: string;
  city?: string;
  state?: string;
  className?: string;
};

/**
 * Live map preview that geocodes the entered address (debounced) and
 * recenters / re-pins as the instructor edits any address field.
 */
export const AddressMapPreview = ({ address, city, state, className }: Props) => {
  const { token, error: tokenError } = useMapboxToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const query = [address, city, state].map((s) => s?.trim()).filter(Boolean).join(", ");

  // Debounced geocode
  useEffect(() => {
    if (!token) return;
    if (!query || (!city && !state)) {
      setCoords(null);
      setGeoError(null);
      return;
    }
    setGeocoding(true);
    setGeoError(null);
    const handle = setTimeout(async () => {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query,
        )}.json?access_token=${token}&country=us&limit=1`;
        const res = await fetch(url);
        const json = await res.json();
        const feat = json?.features?.[0];
        if (feat?.center) {
          setCoords([feat.center[0], feat.center[1]]);
        } else {
          setCoords(null);
          setGeoError("Address not found");
        }
      } catch {
        setGeoError("Could not load map");
      } finally {
        setGeocoding(false);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [query, token, city, state]);

  // Init map
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: coords ?? [-98.5795, 39.8283],
      zoom: coords ? 13 : 3.4,
      interactive: false,
      attributionControl: false,
    });
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token]);

  // Update marker / center when coords change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!coords) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    map.flyTo({ center: coords, zoom: 13, duration: 600 });
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className =
        "h-6 w-6 rounded-full border-2 border-background bg-primary shadow-lg";
      markerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(map);
    } else {
      markerRef.current.setLngLat(coords);
    }
  }, [coords]);

  if (tokenError) {
    return (
      <div className={className}>
        <div className="tactical-card h-32 flex items-center justify-center">
          <div className="text-center text-muted-foreground text-xs">
            <MapPin className="h-6 w-6 text-primary mx-auto mb-1" />
            Map unavailable
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`tactical-card relative h-32 overflow-hidden ${className ?? ""}`}>
      <div ref={containerRef} className="absolute inset-0" />
      {!coords && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80 text-center text-muted-foreground text-xs">
          <div>
            <MapPin className="h-6 w-6 text-primary mx-auto mb-1" />
            {geocoding
              ? "Locating address…"
              : geoError
                ? geoError
                : "Enter an address to preview the map"}
          </div>
        </div>
      )}
      {coords && geocoding && (
        <div className="absolute top-2 right-2 rounded-full bg-card/80 p-1">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
};
