/**
 * Verifies that a course's cover photo on the map actually belongs to that
 * course. Two checks are run per marker:
 *
 *   1. Ownership — the image URL must live under the course's instructor
 *      folder in the `course-photos` bucket (`<instructorId>/<file>`).
 *   2. Reachability — the image must actually load in the browser.
 *
 * Results are cached:
 *   - In-memory (per session) to avoid duplicate inflight checks.
 *   - In localStorage (TTL 24h) so verified covers don't re-check on every
 *     page load. Failed results use a much shorter TTL (5 min) so transient
 *     network blips self-heal.
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

const STORAGE_KEY = 'cover-verify-cache-v1';
const TTL_OK_MS = 24 * 60 * 60 * 1000; // 24h for verified covers
const TTL_FAIL_MS = 5 * 60 * 1000;     // 5min for failures (transient retry window)

type StoredEntry = { result: CoverVerification; expiresAt: number };
type StoredMap = Record<string, StoredEntry>;

const memCache = new Map<string, Promise<CoverVerification>>();

const cacheKey = (courseId: string, url: string | null | undefined) =>
  `${courseId}::${url ?? ''}`;

const readStore = (): StoredMap => {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredMap;
  } catch {
    return {};
  }
};

const writeStore = (map: StoredMap) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota — ignore */
  }
};

const getStored = (key: string): CoverVerification | null => {
  const map = readStore();
  const entry = map[key];
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    delete map[key];
    writeStore(map);
    return null;
  }
  return entry.result;
};

const putStored = (key: string, result: CoverVerification) => {
  const map = readStore();
  // Garbage collect expired entries opportunistically.
  const now = Date.now();
  for (const k of Object.keys(map)) if (map[k].expiresAt < now) delete map[k];
  map[key] = {
    result,
    expiresAt: now + (result.ok ? TTL_OK_MS : TTL_FAIL_MS),
  };
  writeStore(map);
};

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

const isOwnedByInstructor = (url: string, instructorId: string): boolean => {
  if (!instructorId) return true;
  if (!url.includes('/course-photos/')) return true;
  return url.includes(`/course-photos/${instructorId}/`);
};

export const verifyCoverPhoto = (
  input: VerifyInput,
  options: { force?: boolean } = {},
): Promise<CoverVerification> => {
  const { url, instructorId, courseId } = input;
  const key = cacheKey(courseId, url);

  if (!options.force) {
    const stored = getStored(key);
    if (stored) return Promise.resolve(stored);
    const inflight = memCache.get(key);
    if (inflight) return inflight;
  } else {
    memCache.delete(key);
  }

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

  const wrapped = run.then((result) => {
    putStored(key, result);
    return result;
  });

  memCache.set(key, wrapped);
  return wrapped;
};

export const clearCoverVerification = (courseId: string, url: string | null | undefined) => {
  const key = cacheKey(courseId, url);
  memCache.delete(key);
  const map = readStore();
  if (map[key]) {
    delete map[key];
    writeStore(map);
  }
};

export const COVER_VERIFICATION_REASONS: Record<NonNullable<CoverVerification['reason']>, string> = {
  missing: 'No cover photo uploaded',
  wrong_owner: 'Cover photo belongs to a different instructor',
  unreachable: 'Cover photo failed to load',
};
