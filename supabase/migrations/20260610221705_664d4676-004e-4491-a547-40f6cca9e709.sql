
-- Helper: SECURITY DEFINER check that the protected columns are unchanged from the stored row.
CREATE OR REPLACE FUNCTION public.influencer_link_owner_update_allowed(
  _id uuid,
  _owner_user_id uuid,
  _commission_pct numeric,
  _recurring_pct numeric,
  _first_booking_pct numeric,
  _is_vip boolean,
  _vip_pct numeric,
  _access_pin text,
  _slug text,
  _audience text,
  _active boolean
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.influencer_links l
    WHERE l.id = _id
      AND l.owner_user_id IS NOT DISTINCT FROM _owner_user_id
      AND l.commission_pct IS NOT DISTINCT FROM _commission_pct
      AND l.recurring_pct IS NOT DISTINCT FROM _recurring_pct
      AND l.first_booking_pct IS NOT DISTINCT FROM _first_booking_pct
      AND l.is_vip IS NOT DISTINCT FROM _is_vip
      AND l.vip_pct IS NOT DISTINCT FROM _vip_pct
      AND l.access_pin IS NOT DISTINCT FROM _access_pin
      AND l.slug IS NOT DISTINCT FROM _slug
      AND l.audience IS NOT DISTINCT FROM _audience
      AND l.active IS NOT DISTINCT FROM _active
  );
$$;

REVOKE ALL ON FUNCTION public.influencer_link_owner_update_allowed(uuid,uuid,numeric,numeric,numeric,boolean,numeric,text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.influencer_link_owner_update_allowed(uuid,uuid,numeric,numeric,numeric,boolean,numeric,text,text,text,boolean) TO authenticated, service_role;

-- Replace the owner UPDATE policy with one that enforces column-level immutability via RLS itself.
DROP POLICY IF EXISTS "Owners update payout handle on own link" ON public.influencer_links;

CREATE POLICY "Owners update payout handle on own link"
ON public.influencer_links
FOR UPDATE
USING (owner_user_id = auth.uid())
WITH CHECK (
  owner_user_id = auth.uid()
  AND public.influencer_link_owner_update_allowed(
    id,
    owner_user_id,
    commission_pct,
    recurring_pct,
    first_booking_pct,
    is_vip,
    vip_pct,
    access_pin,
    slug,
    audience,
    active
  )
);
