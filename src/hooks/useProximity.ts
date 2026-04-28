import { useEffect, useRef, useState } from 'react';
import { distanceMeters } from '@/lib/qrCheckin';

export type ProximityReading = {
  distanceM: number;
  accuracyM: number;
  smoothedM: number;
  timestamp: number;
};

export type ProximityState = {
  supported: boolean;
  active: boolean;
  error: string | null;
  reading: ProximityReading | null;
  start: () => void;
  stop: () => void;
};

/**
 * "AI" proximity engine — exponential-moving-average smoothing on raw GPS,
 * weighted by reported accuracy so a noisy fix doesn't trigger a false check-in.
 * Calls onTrigger(reading) once when the smoothed distance drops at-or-below
 * triggerMeters with reasonable accuracy.
 */
export function useProximity(opts: {
  target: { lat: number; lng: number } | null;
  triggerMeters: number;
  onTrigger?: (r: ProximityReading) => void;
  enabled?: boolean;
}): ProximityState {
  const { target, triggerMeters, onTrigger, enabled = true } = opts;
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<ProximityReading | null>(null);
  const watchId = useRef<number | null>(null);
  const smoothed = useRef<number | null>(null);
  const fired = useRef(false);

  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const stop = () => {
    if (watchId.current !== null && supported) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    watchId.current = null;
    setActive(false);
  };

  const start = () => {
    if (!supported || !target) {
      setError('Location not available on this device.');
      return;
    }
    if (watchId.current !== null) return;
    setError(null);
    fired.current = false;
    smoothed.current = null;
    setActive(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const raw = distanceMeters(here, target);
        const accuracy = pos.coords.accuracy ?? 50;

        // Adaptive EMA — trust new reading more when accuracy is good.
        // alpha in [0.15..0.6] inverse-mapped from accuracy in [5..50] m.
        const alpha = Math.min(0.6, Math.max(0.15, 1 - Math.min(50, accuracy) / 60));
        smoothed.current =
          smoothed.current === null ? raw : smoothed.current * (1 - alpha) + raw * alpha;

        const r: ProximityReading = {
          distanceM: raw,
          accuracyM: accuracy,
          smoothedM: smoothed.current,
          timestamp: Date.now(),
        };
        setReading(r);

        if (
          !fired.current &&
          accuracy <= 20 && // require a reasonably tight fix
          smoothed.current <= triggerMeters
        ) {
          fired.current = true;
          onTrigger?.(r);
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
  };

  useEffect(() => {
    if (!enabled) stop();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { supported, active, error, reading, start, stop };
}
