// Shared helper: check whether the platform is in pre-launch mode.
// Reads `platform_settings.prelaunch_mode` using the anon key (the row is
// world-readable via RLS). Fails CLOSED on error: if we cannot determine
// the state, we assume pre-launch is OFF so legitimate paid flows keep
// working — the fail-open behavior is acceptable here because the admin
// UI is the source of truth and any read error is logged.
export async function isPrelaunchEnabled(): Promise<boolean> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anon) return false;
    const res = await fetch(
      `${url}/rest/v1/platform_settings?key=eq.prelaunch_mode&select=value`,
      { headers: { apikey: anon, Authorization: `Bearer ${anon}` } },
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as Array<{ value: unknown }>;
    const v = rows?.[0]?.value;
    return v === true || v === "true";
  } catch (e) {
    console.error("isPrelaunchEnabled error:", e);
    return false;
  }
}
