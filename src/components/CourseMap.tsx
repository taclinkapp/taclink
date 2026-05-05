import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import type { Course } from "@/lib/mockData";
import { Map as MapIcon, Loader2 } from "lucide-react";
import {
  verifyCoverPhoto,
  clearCoverVerification,
  COVER_VERIFICATION_REASONS,
  type CoverVerification,
} from "@/lib/coverPhotoVerification";

type Props = {
  courses: Course[];
  className?: string;
  onSelect?: (course: Course) => void;
  interactive?: boolean;
  zoom?: number;
  center?: [number, number];
};

const escapeHtml = (s: string) =>
  s.replace(/[<>&"]/g, (ch) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[ch] as string),
  );

type PopupState = "verifying" | "ok" | "fail";

const renderPopupHtml = (
  c: Course,
  state: PopupState,
  result?: CoverVerification,
): string => {
  const safeTitle = escapeHtml(c.title || "");
  const safeLoc = escapeHtml(
    `${c.city || ""}${c.city && c.state ? ", " : ""}${c.state || ""}`,
  );

  let media = "";
  let statusLine = "";
  if (state === "verifying") {
    media = `<div style="width:100%;height:96px;background:#1a1a1a;display:flex;align-items:center;justify-content:center;color:#888;font-size:10px;letter-spacing:.1em;">VERIFYING…</div>`;
    statusLine = `<div style="font-size:9px;color:#999;margin-top:4px;text-transform:uppercase;letter-spacing:.08em;">Verifying photo…</div>`;
  } else if (state === "ok" && c.heroImage) {
    media = `<img src="${escapeHtml(c.heroImage)}" alt="" style="width:100%;height:96px;object-fit:cover;display:block;" />`;
    statusLine = `<div style="font-size:9px;color:#15803d;margin-top:4px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;">✓ Verified photo</div>`;
  } else {
    const reason = result?.reason ? COVER_VERIFICATION_REASONS[result.reason] : "Unverified";
    media = `<div style="width:100%;height:96px;background:#2a1a1a;display:flex;align-items:center;justify-content:center;color:#fca5a5;font-size:10px;letter-spacing:.1em;text-align:center;padding:0 8px;">UNVERIFIED</div>`;
    statusLine = `
      <div style="font-size:9px;color:#b91c1c;margin-top:6px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;">⚠ ${escapeHtml(reason)}</div>
      <button data-cover-retry="${escapeHtml(c.id)}" type="button" style="margin-top:6px;width:100%;padding:6px 8px;border:1px solid #b91c1c;background:transparent;color:#b91c1c;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;border-radius:4px;cursor:pointer;">Retry verification</button>
    `;
  }

  return `<div style="width:200px;font-family:inherit;">
    <div data-cover-media>${media}</div>
    <div style="padding:8px 10px;">
      <div style="font-weight:800;font-size:12px;line-height:1.2;color:#111;">${safeTitle}</div>
      <div style="font-size:10px;color:#555;margin-top:2px;">${safeLoc}</div>
      <div style="font-size:11px;font-weight:800;color:#b45309;margin-top:4px;">$${c.bookingFee}</div>
      <div data-cover-status>${statusLine}</div>
    </div>
  </div>`;
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
  const popupsByCourseRef = useRef<Map<string, mapboxgl.Popup>>(new Map());
  const markerDotsByCourseRef = useRef<Map<string, HTMLElement>>(new Map());
  const verifyStateRef = useRef<Map<string, CoverVerification>>(new Map());
  const coursesByIdRef = useRef<Map<string, Course>>(new Map());
  const { token, error } = useMapboxToken();

  // Init map once we have a token
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;

    const initialCenter: [number, number] =
      center ??
      (courses.length === 1 ? [courses[0].lng, courses[0].lat] : [-98.5795, 39.8283]);
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
      popupsByCourseRef.current.clear();
      markerDotsByCourseRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Apply visual state (popup html + marker dot) for a single course.
  const applyVerificationToUi = (course: Course, state: PopupState, result?: CoverVerification) => {
    const popup = popupsByCourseRef.current.get(course.id);
    if (popup) {
      // setHTML works whether the popup is open or closed; if it's open it
      // re-renders in place.
      popup.setHTML(renderPopupHtml(course, state, result));
    }
    const dot = markerDotsByCourseRef.current.get(course.id);
    if (dot) {
      const badge = dot.querySelector<HTMLElement>("[data-verify-badge]");
      if (badge) {
        if (state === "fail") {
          badge.style.display = "flex";
          badge.title = result?.reason
            ? COVER_VERIFICATION_REASONS[result.reason]
            : "Cover photo unverified";
        } else {
          badge.style.display = "none";
        }
      }
    }
  };

  // Render markers when courses change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    popupsByCourseRef.current.clear();
    markerDotsByCourseRef.current.clear();
    coursesByIdRef.current = new Map(courses.map((c) => [c.id, c]));

    courses.forEach((c) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className =
        "group relative flex h-8 min-w-[2.25rem] items-center justify-center rounded-full border-2 border-background bg-primary px-2 text-[11px] font-black text-primary-foreground shadow-lg transition hover:scale-110";
      el.innerHTML = `
        <span>$${c.bookingFee}</span>
        <span data-verify-badge style="display:none;position:absolute;top:-6px;right:-6px;width:16px;height:16px;border-radius:9999px;background:#b91c1c;color:#fff;font-size:10px;font-weight:900;align-items:center;justify-content:center;border:2px solid #0a0a0a;line-height:1;">!</span>
      `;

      const initial = verifyStateRef.current.get(c.id);
      const initialState: PopupState = initial ? (initial.ok ? "ok" : "fail") : "verifying";
      const popup = new mapboxgl.Popup({
        offset: 16,
        closeButton: false,
        maxWidth: "220px",
      }).setHTML(renderPopupHtml(c, initialState, initial));

      popupsByCourseRef.current.set(c.id, popup);
      markerDotsByCourseRef.current.set(c.id, el);

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

      // Apply already-known state badge immediately.
      if (initial) applyVerificationToUi(c, initial.ok ? "ok" : "fail", initial);
    });

    // Up-front verification for ALL markers (not just opened popups). Cached
    // results from localStorage resolve synchronously; new ones run in
    // parallel and update the UI as each completes.
    courses.forEach((c) => {
      verifyCoverPhoto({
        courseId: c.id,
        instructorId: c.instructorId,
        url: c.heroImage,
      }).then((result) => {
        verifyStateRef.current.set(c.id, result);
        const fresh = coursesByIdRef.current.get(c.id);
        if (!fresh) return;
        applyVerificationToUi(fresh, result.ok ? "ok" : "fail", result);
      });
    });

    // Fit bounds when multiple courses
    if (courses.length > 1 && interactive) {
      const bounds = new mapboxgl.LngLatBounds();
      courses.forEach((c) => bounds.extend([c.lng, c.lat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 8, duration: 0 });
    }
  }, [courses, onSelect, interactive]);

  // Event delegation for the Retry button inside popups.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest<HTMLElement>("[data-cover-retry]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const courseId = btn.getAttribute("data-cover-retry");
      if (!courseId) return;
      const course = coursesByIdRef.current.get(courseId);
      if (!course) return;
      // Show verifying state, blow away cached failure, re-run.
      applyVerificationToUi(course, "verifying");
      clearCoverVerification(course.id, course.heroImage);
      verifyCoverPhoto(
        { courseId: course.id, instructorId: course.instructorId, url: course.heroImage },
        { force: true },
      ).then((result) => {
        verifyStateRef.current.set(course.id, result);
        applyVerificationToUi(course, result.ok ? "ok" : "fail", result);
      });
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, []);

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
