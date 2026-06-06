
DROP POLICY IF EXISTS "Public can view instructor profiles" ON public.profiles;

CREATE OR REPLACE VIEW public.public_instructor_profiles AS
SELECT
  p.id, p.display_name, p.photo_url, p.bio, p.state,
  p.service_state, p.service_city, p.service_categories, p.created_at
FROM public.profiles p
WHERE EXISTS (SELECT 1 FROM public.courses c WHERE c.instructor_id = p.id);

GRANT SELECT ON public.public_instructor_profiles TO anon, authenticated;

DROP POLICY IF EXISTS "Authenticated read active provider" ON public.payment_provider_settings;

DROP FUNCTION IF EXISTS public.get_active_payment_provider();

CREATE FUNCTION public.get_active_payment_provider()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT active_provider::text
  FROM public.payment_provider_settings
  ORDER BY id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_active_payment_provider() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_payment_provider() TO anon, authenticated;

DROP POLICY IF EXISTS "Owners and admins read full influencer link" ON public.influencer_links;
DROP POLICY IF EXISTS "Owners read their own link" ON public.influencer_links;

CREATE OR REPLACE VIEW public.affiliate_my_link AS
SELECT
  l.id, l.slug, l.influencer_name, l.influencer_handle, l.audience, l.active,
  l.is_vip, l.vip_starts_at, l.vip_duration_days,
  l.payout_method, l.payout_handle, l.payout_notes,
  l.owner_user_id, l.created_at, l.updated_at
FROM public.influencer_links l
WHERE l.owner_user_id = auth.uid();

GRANT SELECT ON public.affiliate_my_link TO authenticated;
