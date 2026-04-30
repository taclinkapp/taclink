-- Harden influencer slug availability check + add normalize helper + case-insensitive uniqueness.

-- 1. Normalizer: trims, lowercases, strips invalid chars, clamps length, returns NULL if invalid.
CREATE OR REPLACE FUNCTION public.normalize_influencer_slug(_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  IF _raw IS NULL THEN RETURN NULL; END IF;
  v := LOWER(TRIM(_raw));
  -- collapse non-alphanum runs to single hyphen
  v := REGEXP_REPLACE(v, '[^a-z0-9]+', '-', 'g');
  v := REGEXP_REPLACE(v, '^-+|-+$', '', 'g');
  IF v = '' THEN RETURN NULL; END IF;
  IF LENGTH(v) < 2 OR LENGTH(v) > 32 THEN RETURN NULL; END IF;
  -- must start with alphanumeric (regex above guarantees, but double-check)
  IF v !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' AND v !~ '^[a-z0-9]$' THEN
    RETURN NULL;
  END IF;
  -- block reserved words
  IF v IN ('admin','api','auth','login','signup','signin','i','app','www','root','null','undefined','support','help','new','edit','delete') THEN
    RETURN NULL;
  END IF;
  RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_influencer_slug(text) TO anon, authenticated;

-- 2. Replace availability RPC with structured response: { ok, normalized, reason }.
CREATE OR REPLACE FUNCTION public.check_influencer_slug_available(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_taken boolean;
BEGIN
  IF _slug IS NULL OR LENGTH(TRIM(_slug)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'normalized', null, 'reason', 'empty');
  END IF;
  v_norm := public.normalize_influencer_slug(_slug);
  IF v_norm IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'normalized', null, 'reason', 'invalid_format');
  END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.influencer_links WHERE LOWER(slug) = v_norm
  ) INTO v_taken;
  IF v_taken THEN
    RETURN jsonb_build_object('ok', false, 'normalized', v_norm, 'reason', 'taken');
  END IF;
  RETURN jsonb_build_object('ok', true, 'normalized', v_norm, 'reason', 'available');
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_influencer_slug_available(text) TO anon, authenticated;

-- 3. Keep legacy boolean RPC working but harden it (normalizes input before lookup).
CREATE OR REPLACE FUNCTION public.is_influencer_slug_available(_slug text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
BEGIN
  v_norm := public.normalize_influencer_slug(_slug);
  IF v_norm IS NULL THEN RETURN false; END IF;
  RETURN NOT EXISTS(SELECT 1 FROM public.influencer_links WHERE LOWER(slug) = v_norm);
END;
$$;

-- 4. Case-insensitive uniqueness guard at the DB level (covers any future direct inserts).
CREATE UNIQUE INDEX IF NOT EXISTS idx_influencer_links_slug_lower_uniq
  ON public.influencer_links (LOWER(slug));

-- 5. Trigger to normalize slug on insert/update so whitespace/case can never sneak in.
CREATE OR REPLACE FUNCTION public.influencer_links_normalize_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_norm text;
BEGIN
  v_norm := public.normalize_influencer_slug(NEW.slug);
  IF v_norm IS NULL THEN
    RAISE EXCEPTION 'invalid_slug_format' USING ERRCODE = '22023';
  END IF;
  NEW.slug := v_norm;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_influencer_links_normalize_slug ON public.influencer_links;
CREATE TRIGGER trg_influencer_links_normalize_slug
  BEFORE INSERT OR UPDATE OF slug ON public.influencer_links
  FOR EACH ROW EXECUTE FUNCTION public.influencer_links_normalize_slug();