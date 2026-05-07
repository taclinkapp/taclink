/**
 * Single source of truth for resolving a user's avatar image.
 *
 * Every surface that renders a user's photo (dashboards, profile pages,
 * operator profile, rosters, reviews, etc.) should pass the user's stored
 * `photo_url` through `getAvatarSrc` so the same image (or the same
 * deterministic fallback) is shown everywhere.
 *
 *  - If the user has uploaded a photo, that exact URL is returned.
 *  - Otherwise we generate a deterministic DiceBear "initials" SVG seeded
 *    on the user's display name, so the same person always gets the same
 *    fallback avatar across the app.
 */
export function getAvatarSrc(
  photoUrl: string | null | undefined,
  displayName: string | null | undefined,
): string {
  const url = (photoUrl ?? '').trim();
  if (url) return url;
  const seed = (displayName ?? 'User').trim() || 'User';
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}
