import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Auto sign-out after prolonged inactivity. Resets on user input,
// navigation, or tab focus. Uses localStorage so multiple tabs share
// the same "last activity" timestamp.
const IDLE_MS = 30 * 60 * 1000; // 30 minutes
const WARN_MS = 60 * 1000; // warn 60s before sign-out
const STORAGE_KEY = 'taclink_last_activity_at';
const CHECK_INTERVAL_MS = 15 * 1000;

export const useIdleSignOut = () => {
  const { user, signOut } = useAuth();
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    const markActive = () => {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        // ignore
      }
      warnedRef.current = false;
    };

    const readLastActivity = (): number => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const n = raw ? Number(raw) : NaN;
        return Number.isFinite(n) ? n : Date.now();
      } catch {
        return Date.now();
      }
    };

    // Seed initial activity
    markActive();

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll', 'focus'] as const;
    activityEvents.forEach((ev) =>
      window.addEventListener(ev, markActive, { passive: true })
    );
    document.addEventListener('visibilitychange', markActive);

    const tick = async () => {
      const idleFor = Date.now() - readLastActivity();
      if (idleFor >= IDLE_MS) {
        toast.message('Signed out for inactivity', {
          description: 'Please sign in again to continue.',
        });
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
        await signOut();
        return;
      }
      if (!warnedRef.current && idleFor >= IDLE_MS - WARN_MS) {
        warnedRef.current = true;
        toast.warning('You will be signed out soon', {
          description: 'Move the mouse or press a key to stay signed in.',
          duration: WARN_MS,
        });
      }
    };

    const interval = window.setInterval(tick, CHECK_INTERVAL_MS);

    return () => {
      activityEvents.forEach((ev) =>
        window.removeEventListener(ev, markActive)
      );
      document.removeEventListener('visibilitychange', markActive);
      window.clearInterval(interval);
    };
  }, [user, signOut]);
};
