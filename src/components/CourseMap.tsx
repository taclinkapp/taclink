import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import type { Course } from "@/lib/mockData";
import { Map as MapIcon, Loader2 } from "lucide-react";

type Props = {
  courses: Course[];
  className?: string;
  onSelect?: (course: Course) => void;
  interactive?: boolean;
  zoom?: number;
  center?: [number, number];
};

export const CourseMap = ({
  courses,
  className,
  onSelect,
  interactive = true,
  zoom,
  center,
}: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const { token, error } = useMapboxToken();

  // Init map once we have a token
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;

    // Default: center over continental US, or supplied center
    const initialCenter: [number, number] =
      center ??
      (courses.length === 1
        ? [courses[0].lng, courses[0].lat]
        : [-98.5795, 39.8283]);
    const initialZoom = zoom ?? (courses.length === 1 ? 11 : 3.4);

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: initialCenter,
      zoom: initialZoom,
      interactive,
      attributionControl: false,
    });
    if (interactive) {
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    }
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Render markers when courses change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    courses.forEach((c) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className =
        "group relative flex h-8 min-w-[2.25rem] items-center justify-center rounded-full border-2 border-background bg-primary px-2 text-[11px] font-black text-primary-foreground shadow-lg transition hover:scale-110";
      el.innerText = `$${c.bookingFee}`;
      if (onSelect) {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelect(c);
        });
      }
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([c.lng, c.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });

    // Fit bounds when multiple courses
    if (courses.length > 1 && interactive) {
      const bounds = new mapboxgl.LngLatBounds();
      courses.forEach((c) => bounds.extend([c.lng, c.lat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 8, duration: 0 });
    }
  }, [courses, onSelect, interactive]);

  if (error) {
    return (
      <div className={className}>
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-card text-muted-foreground">
          <MapIcon className="h-8 w-8" />
          <p className="text-xs uppercase tracking-wider">Map unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ position: "relative" }}>
      <div ref={containerRef} className="absolute inset-0" />
      {!token && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
};
