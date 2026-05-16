import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLaunchState } from "@/hooks/useLaunchState";

const STORAGE_PREFIX = "taclink:launch_live_notified:";

/**
 * Fires a one-time "We're live" notification (in-app toast + native Notification)
 * to logged-in users when the app transitions to live mode. Dedupes per
 * activation timestamp per user using localStorage so it never re-fires.
 */
export const LaunchLiveNotifier = () => {
  const { user } = useAuth();
  const launch = useLaunchState();
  const navigate = useNavigate();
  const prevModeRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevModeRef.current;
    prevModeRef.current = launch.mode;

    if (!user) return;
    if (!launch.isLive) return;

    // Require either a clean transition observed in this session,
    // OR a fresh activation we haven't acknowledged for this user yet.
    const activationKey = launch.activatedAtIso ?? "unknown";
    const storageKey = `${STORAGE_PREFIX}${user.id}:${activationKey}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(storageKey)) return;

    const transitionedThisSession = prev && prev !== "live";
    const recentlyActivated =
      launch.activatedAtIso &&
      Date.now() - new Date(launch.activatedAtIso).getTime() < 10 * 60 * 1000;

    if (!transitionedThisSession && !recentlyActivated) return;

    try {
      window.localStorage.setItem(storageKey, String(Date.now()));
    } catch {
      // ignore quota errors
    }

    toast.success("TacLink is live", {
      description: "Booking and publishing are open. Tap to start exploring.",
      duration: 12_000,
      action: {
        label: "Open",
        onClick: () => navigate("/student"),
      },
    });

    // Best-effort native notification for users who granted permission.
    if (typeof window !== "undefined" && "Notification" in window) {
      const fire = () => {
        try {
          const n = new Notification("TacLink is live", {
            body: "Booking and publishing are now open.",
            tag: `taclink-live-${activationKey}`,
            icon: "/favicon.ico",
          });
          n.onclick = () => {
            window.focus();
            navigate("/student");
            n.close();
          };
        } catch {
          // some browsers throw outside SW context — ignore
        }
      };
      if (Notification.permission === "granted") {
        fire();
      } else if (Notification.permission === "default") {
        Notification.requestPermission().then((p) => {
          if (p === "granted") fire();
        }).catch(() => {});
      }
    }
  }, [launch.mode, launch.isLive, launch.activatedAtIso, user, navigate]);

  return null;
};

export default LaunchLiveNotifier;
