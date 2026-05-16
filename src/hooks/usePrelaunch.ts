import { useLaunchState } from "./useLaunchState";

/**
 * Backward-compatible shim. New code should use `useLaunchState` directly.
 * `enabled` here means "the app is in prelaunch mode" (effective mode, so it
 * automatically flips to false when launch_at passes).
 */
export type PrelaunchConfig = {
  enabled: boolean;
  launchDateIso: string | null;
};

export const usePrelaunch = () => {
  const state = useLaunchState();
  return {
    data: {
      enabled: state.isPrelaunch,
      launchDateIso: state.launchAtIso,
    } as PrelaunchConfig,
    isLoading: false,
  };
};
