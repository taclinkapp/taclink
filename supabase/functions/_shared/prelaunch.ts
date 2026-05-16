// Backwards-compat helper. Reads from `get_effective_launch_state` so we get
// the same auto-promotion behavior as the client. Fails CLOSED to `prelaunch`
// so paid flows that gate on prelaunch can't accidentally open up.
export type EdgeLaunchState = {
  mode: "prelaunch" | "live" | "paused";
  bookingsEnabled: boolean;
  publishEnabled: boolean;
  proUnlockEnabled: boolean;
  launchAtIso: string | null;
};

export async function getLaunchState(): Promise<EdgeLaunchState> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anon) return safe();
    const res = await fetch(`${url}/rest/v1/rpc/get_effective_launch_state`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!res.ok) return safe();
    const raw = await res.json();
    return {
      mode: (raw?.mode ?? "prelaunch") as EdgeLaunchState["mode"],
      bookingsEnabled: !!raw?.bookings_enabled,
      publishEnabled: !!raw?.publish_enabled,
      proUnlockEnabled: !!raw?.pro_unlock_enabled,
      launchAtIso: raw?.launch_at ?? null,
    };
  } catch (e) {
    console.error("getLaunchState error:", e);
    return safe();
  }
}

function safe(): EdgeLaunchState {
  return { mode: "prelaunch", bookingsEnabled: false, publishEnabled: false, proUnlockEnabled: false, launchAtIso: null };
}

// Kept for backward compatibility with existing callers.
export async function isPrelaunchEnabled(): Promise<boolean> {
  const s = await getLaunchState();
  return s.mode === "prelaunch";
}
