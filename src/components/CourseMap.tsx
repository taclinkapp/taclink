import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import type { Course } from "@/lib/mockData";
import { Map as MapIcon, Loader2 } from "lucide-react";
import { verifyCoverPhoto, COVER_VERIFICATION_REASONS } from "@/lib/coverPhotoVerification";

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

      // Image popup so the cover photo is visible from the map.
      const safeTitle = (c.title || "").replace(/[<>&"]/g, (ch) => ({"<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;"}[ch] as string));
      const safeLoc = `${c.city || ""}${c.city && c.state ? ", " : ""}${c.state || ""}`.replace(/[<>&"]/g, (ch) => ({"<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;"}[ch] as string));

      // Verification placeholder shown until verifyCoverPhoto resolves. We
      // never display an unverified image — it gets swapped in only after the
      // ownership + reachability check passes for THIS course.
      const placeholderHtml = `<div data-cover-slot="1" style="width:100%;height:96px;background:#1a1a1a;display:flex;align-items:center;justify-content:center;color:#888;font-size:10px;letter-spacing:.1em;">VERIFYING…</div>`;
      const popup = new mapboxgl.Popup({ offset: 16, closeButton: false, maxWidth: "220px" }).setHTML(
        `<div style="width:200px;font-family:inherit;">
          ${placeholderHtml}
          <div style="padding:8px 10px;">
            <div style="font-weight:800;font-size:12px;line-height:1.2;color:#111;">${safeTitle}</div>
            <div style="font-size:10px;color:#555;margin-top:2px;">${safeLoc}</div>
            <div style="font-size:11px;font-weight:800;color:#b45309;margin-top:4px;">$${c.bookingFee}</div>
            <div data-cover-status="1" style="font-size:9px;color:#999;margin-top:4px;text-transform:uppercase;letter-spacing:.08em;">Verifying photo…</div>
          </div>
        </div>`,
      );

      // Run verification in the background; swap the slot once we know the
      // image truly belongs to this course and loads successfully.
      verifyCoverPhoto({ courseId: c.id, instructorId: c.instructorId, url: c.heroImage }).then((result) => {
        const root = popup.getElement();
        if (!root) return;
        const slot = root.querySelector<HTMLElement>('[data-cover-slot="1"]');
        const status = root.querySelector<HTMLElement>('[data-cover-status="1"]');
        if (!slot) return;
        if (result.ok && c.heroImage) {
          slot.outerHTML = `<img src="${c.heroImage}" alt="" style="width:100%;height:96px;object-fit:cover;display:block;" />`;
          if (status) {
            status.textContent = '✓ Verified photo';
            status.style.color = '#15803d';
          }
        } else {
          const reason = result.reason ? COVER_VERIFICATION_REASONS[result.reason] : 'Unverified';
          slot.outerHTML = `<div style="width:100%;height:96px;background:#2a1a1a;display:flex;align-items:center;justify-content:center;color:#fca5a5;font-size:10px;letter-spacing:.1em;text-align:center;padding:0 8px;">UNVERIFIED</div>`;
          if (status) {
            status.textContent = `⚠ ${reason}`;
            status.style.color = '#b91c1c';
          }
        }
      });

      if (onSelect) {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelect(c);
        });
      }
      el.addEventListener("mouseenter", () => popup.addTo(map));
      el.addEventListener("mouseleave", () => popup.remove());

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([c.lng, c.lat])
        .setPopup(popup)
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
