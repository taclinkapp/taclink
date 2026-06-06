
-- Tear down the interim policies / views
DROP POLICY IF EXISTS "Public instructor row read (safe cols via view)" ON public.profiles;
DROP POLICY IF EXISTS "Owners read own influencer link (safe cols via view)" ON public.influencer_links;
DROP VIEW IF EXISTS public.public_instructor_profiles;
DROP VIEW IF EXISTS public.affiliate_my_link;

-- Safe public read of instructor profile fields (no phone, no payout IDs, no status flags)
CREATE OR REPLACE FUNCTION public.get_public_instructor_profile(_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  photo_url text,
  bio text,
  state text,
  service_state text,
  service_city text,
  service_categories text[],
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.photo_url, p.bio, p.state,
         p.service_state, p.service_city, p.service_categories, p.created_at
  FROM public.profiles p
  WHERE p.id = _id
    AND EXISTS (SELECT 1 FROM public.courses c WHERE c.instructor_id = p.id);
$$;

REVOKE ALL ON FUNCTION public.get_public_instructor_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_instructor_profile(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_public_instructor_profiles(_ids uuid[])
RETURNS TABLE (
  id uuid,
  display_name text,
  photo_url text,
  bio text,
  state text,
  service_state text,
  service_city text,
  service_categories text[],
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.photo_url, p.bio, p.state,
         p.service_state, p.service_city, p.service_categories, p.created_at
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND EXISTS (SELECT 1 FROM public.courses c WHERE c.instructor_id = p.id);
$$;

REVOKE ALL ON FUNCTION public.list_public_instructor_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_instructor_profiles(uuid[]) TO anon, authenticated;

-- Safe affiliate-owner read: NO access_pin, NO commission percentages
CREATE OR REPLACE FUNCTION public.get_my_affiliate_links()
RETURNS TABLE (
  id uuid,
  slug text,
  influencer_name text,
  influencer_handle text,
  audience text,
  active boolean,
  is_vip boolean,
  vip_starts_at timestamptz,
  vip_duration_days integer,
  payout_method text,
  payout_handle text,
  payout_notes text,
  owner_user_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.slug, l.influencer_name, l.influencer_handle, l.audience,
         l.active, l.is_vip, l.vip_starts_at, l.vip_duration_days,
         l.payout_method, l.payout_handle, l.payout_notes,
         l.owner_user_id, l.created_at, l.updated_at
  FROM public.influencer_links l
  WHERE l.owner_user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_affiliate_links() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_affiliate_links() TO authenticated;
