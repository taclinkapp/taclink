// Tiered student cancellation grace period.
// Mirrors the server-side compute_cancel_cutoff_hours() in Supabase so the UI
// can show the same deadline the database will enforce.
//
// Tiers (lead time = course.starts_at - booking.booked_at):
//   >= 7 days  -> 72h grace
//   >= 3 days  -> 48h grace
//   >= 1 day   -> 24h grace
//   <  1 day   -> 0h  (no grace; any cancel is "late")

export type CancelTier = {
  hours: number;
  label: string;
};

export function cancelCutoffHours(startsAt: Date | string | null, bookedAt: Date | string | null): number {
  if (!startsAt || !bookedAt) return 48;
  const s = new Date(startsAt).getTime();
  const b = new Date(bookedAt).getTime();
  const leadH = (s - b) / 3_600_000;
  if (leadH >= 168) return 72;
  if (leadH >= 72) return 48;
  if (leadH >= 24) return 24;
  return 0;
}

export function cancelDeadline(
  startsAt: Date | string | null,
  bookedAt: Date | string | null,
  cutoffHoursOverride?: number | null,
): Date | null {
  if (!bookedAt || !startsAt) return null;
  const cutoff = cutoffHoursOverride ?? cancelCutoffHours(startsAt, bookedAt);
  if (cutoff <= 0) return null; // no grace window
  const deadline = new Date(new Date(bookedAt).getTime() + cutoff * 3_600_000);
  const start = new Date(startsAt);
  return deadline < start ? deadline : start;
}

export function formatCountdown(target: Date, now: Date = new Date()): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return 'expired';
  const totalMin = Math.floor(ms / 60_000);
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin % (60 * 24)) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}
