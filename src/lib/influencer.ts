// Influencer link attribution helpers (client-side).
// A slug captured at /i/:slug is stashed in sessionStorage and read by the
// signup pages so it can be sent to Supabase as user_metadata.influencer_slug.

const KEY = 'taclink.influencer_slug';

export const saveInfluencerSlug = (slug: string) => {
  const clean = (slug || '').trim().toLowerCase();
  if (!clean) return;
  try {
    sessionStorage.setItem(KEY, clean);
  } catch {
    /* noop */
  }
};

export const readInfluencerSlug = (search?: string): string | null => {
  // Querystring wins (?inf=slug) so freshly-clicked links override stale storage.
  try {
    const params = new URLSearchParams(search ?? window.location.search);
    const fromQuery = params.get('inf');
    if (fromQuery) {
      const clean = fromQuery.trim().toLowerCase();
      saveInfluencerSlug(clean);
      return clean;
    }
  } catch {
    /* noop */
  }
  try {
    const stored = sessionStorage.getItem(KEY);
    return stored ? stored.toLowerCase() : null;
  } catch {
    return null;
  }
};

export const clearInfluencerSlug = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
};

export const buildInfluencerUrl = (slug: string) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/i/${encodeURIComponent(slug)}`;
};
