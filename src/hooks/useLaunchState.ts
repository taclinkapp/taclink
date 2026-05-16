import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LaunchMode = "prelaunch" | "live" | "paused";

export type LaunchState = {
  mode: LaunchMode;
  configuredMode: LaunchMode;
  isLive: boolean;
  isPrelaunch: boolean;
  isPaused: boolean;
  launchAtIso: string | null;
  manualOverride: boolean;
  flags: {
    countdownEnabled: boolean;
    bookingsEnabled: boolean;
    courseCreationEnabled: boolean;
    publishEnabled: boolean;
    proUnlockEnabled: boolean;
    waitlistEnabled: boolean;
  };
  maintenanceMessage: string | null;
  activatedAtIso: string | null;
  serverTimeIso: string | null;
};

// Fail-safe default: prelaunch with all transactional flags OFF. Used if the
// RPC fails so we never accidentally expose booking/publish/pro paths.
const SAFE_DEFAULT: LaunchState = {
  mode: "prelaunch",
  configuredMode: "prelaunch",
  isLive: false,
  isPrelaunch: true,
  isPaused: false,
  launchAtIso: null,
  manualOverride: false,
  flags: {
    countdownEnabled: true,
    bookingsEnabled: false,
    courseCreationEnabled: false,
    publishEnabled: false,
    proUnlockEnabled: false,
    waitlistEnabled: true,
  },
  maintenanceMessage: null,
  activatedAtIso: null,
  serverTimeIso: null,
};

const QUERY_KEY = ["launch_state"] as const;

const parse = (raw: any): LaunchState => {
  const mode = (raw?.mode ?? "prelaunch") as LaunchMode;
  return {
    mode,
    configuredMode: (raw?.configured_mode ?? mode) as LaunchMode,
    isLive: mode === "live",
    isPrelaunch: mode === "prelaunch",
    isPaused: mode === "paused",
    launchAtIso: raw?.launch_at ?? null,
    manualOverride: !!raw?.manual_override,
    flags: {
      countdownEnabled: !!raw?.countdown_enabled,
      bookingsEnabled: !!raw?.bookings_enabled,
      courseCreationEnabled: !!raw?.course_creation_enabled,
      publishEnabled: !!raw?.publish_enabled,
      proUnlockEnabled: !!raw?.pro_unlock_enabled,
      waitlistEnabled: !!raw?.waitlist_enabled,
    },
    maintenanceMessage: raw?.maintenance_message ?? null,
    activatedAtIso: raw?.activated_at ?? null,
    serverTimeIso: raw?.server_time ?? null,
  };
};

export const useLaunchState = () => {
  const qc = useQueryClient();

  const query = useQuery<LaunchState>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_effective_launch_state");
      if (error) {
        console.error("[launch] get_effective_launch_state failed", error);
        return SAFE_DEFAULT;
      }
      return parse(data);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: SAFE_DEFAULT,
  });

  // Realtime: any change to launch_config refetches all subscribers.
  useEffect(() => {
    const channel = supabase
      .channel("launch_config_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "launch_config" },
        () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // App resume / tab visible: revalidate.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        qc.invalidateQueries({ queryKey: QUERY_KEY });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [qc]);

  // When the local clock crosses the configured launch time, refetch once so
  // the auto-promotion (server side) becomes visible without waiting for cron.
  useEffect(() => {
    const launchAt = query.data?.launchAtIso;
    if (!launchAt || query.data?.isLive) return;
    const ms = new Date(launchAt).getTime() - Date.now();
    if (ms <= 0 || ms > 24 * 60 * 60 * 1000) return; // only schedule within next 24h
    const id = setTimeout(() => qc.invalidateQueries({ queryKey: QUERY_KEY }), ms + 2_000);
    return () => clearTimeout(id);
  }, [query.data?.launchAtIso, query.data?.isLive, qc]);

  return query.data ?? SAFE_DEFAULT;
};

export const SAFE_LAUNCH_DEFAULT = SAFE_DEFAULT;
