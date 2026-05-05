/**
 * Verifies that a course's cover photo on the map actually belongs to that
 * course. Two checks are run per marker:
 *
 *   1. Ownership — the image URL must live under the course's instructor
 *      folder in the `course-photos` bucket (`<instructorId>/<file>`).
 *      This catches accidental cross-course / cross-instructor swaps where
 *      a marker would otherwise show another instructor's photo.
 *   2. Reachability — the image must actually load in the browser. Broken
 *      links, deleted storage objects, or hot-linked external images that
 *      404 are flagged so the marker can fall back to a placeholder.
 *
 * Results are cached per URL so we never hit the network twice for the same
 * cover during a session.
 */

export type CoverVerification = {
  ok: boolean;
  reason?: 'missing' | 'wrong_owner' | 'unreachable';
};

type VerifyInput = {
  courseId: string;
  instructorId: string;
  url: string | null | undefined;
};

const cache = new Map<string, Promise<CoverVerification>>();

const checkReachable = (url: string): Promise<boolean> =>
  new Promise((resolve) => {
    const img = new Image();
    const t = window.setTimeout(() => {
      img.src = '';
      resolve(false);
    }, 8000);
    img.onload = () => {
      window.clearTimeout(t);
      resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
    };
    img.onerror = () => {
      window.clearTimeout(t);
      resolve(false);
    };
    img.src = url;
  });

/**
 * Owned-by check: cover photos uploaded through the platform live at
 * `course-photos/<instructorId>/<uuid>.<ext>`. We accept any URL whose path
 * contains that instructor segment. Non-Supabase URLs (e.g. seeded
 * placeholder) are treated as ownership-neutral so they don't false-flag.
 */
const isOwnedByInstructor = (url: string, instructorId: string): boolean => {
  if (!instructorId) return true;
  // Only enforce ownership for our own storage bucket.
  if (!url.includes('/course-photos/')) return true;
  return url.includes(`/course-photos/${instructorId}/`);
};

export const verifyCoverPhoto = (input: VerifyInput): Promise<CoverVerification> => {
  const { url, instructorId, courseId } = input;
  const key = `${courseId}::${url ?? ''}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const run = (async (): Promise<CoverVerification> => {
    if (!url) return { ok: false, reason: 'missing' };
    if (!isOwnedByInstructor(url, instructorId)) {
      console.warn(
        `[CoverPhotoVerification] Course ${courseId} cover URL does not belong to instructor ${instructorId}:`,
        url,
      );
      return { ok: false, reason: 'wrong_owner' };
    }
    const reachable = await checkReachable(url);
    if (!reachable) {
      console.warn(`[CoverPhotoVerification] Course ${courseId} cover unreachable:`, url);
      return { ok: false, reason: 'unreachable' };
    }
    return { ok: true };
  })();

  cache.set(key, run);
  return run;
};

export const COVER_VERIFICATION_REASONS: Record<NonNullable<CoverVerification['reason']>, string> = {
  missing: 'No cover photo uploaded',
  wrong_owner: 'Cover photo belongs to a different instructor',
  unreachable: 'Cover photo failed to load',
};
