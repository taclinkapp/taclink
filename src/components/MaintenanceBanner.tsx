import { AlertTriangle } from "lucide-react";
import { useLaunchState } from "@/hooks/useLaunchState";

/**
 * Global banner shown when the app is in paused/maintenance mode. Renders
 * nothing in prelaunch or live mode. Backend-driven; updates in realtime.
 */
export const MaintenanceBanner = () => {
  const launch = useLaunchState();
  if (!launch.isPaused) return null;
  const msg = launch.maintenanceMessage ||
    "We're temporarily paused for maintenance. Bookings and publishing are disabled — please check back shortly.";
  return (
    <div className="sticky top-0 z-[70] w-full bg-amber-500 text-amber-950 text-xs sm:text-sm font-bold px-3 py-2 flex items-center gap-2 shadow">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="truncate">{msg}</span>
    </div>
  );
};
