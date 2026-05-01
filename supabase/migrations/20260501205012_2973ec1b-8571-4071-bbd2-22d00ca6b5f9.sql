
-- 1. INFLUENCER LINKS
DROP POLICY IF EXISTS "Public reads active influencer links" ON public.influencer_links;
DROP POLICY IF EXISTS "Public reads safe columns of active links" ON public.influencer_links;

REVOKE SELECT ON public.influencer_links FROM anon;
REVOKE SELECT ON public.influencer_links FROM authenticated;
GRANT SELECT (id, slug, influencer_name, audience, active) ON public.influencer_links TO anon, authenticated;
GRANT SELECT ON public.influencer_links TO authenticated;

CREATE POLICY "Public reads safe columns of active links"
ON public.influencer_links
FOR SELECT
TO anon, authenticated
USING (active = true);

-- 2. MESSAGES
DROP POLICY IF EXISTS "Sender must be a conversation participant" ON public.messages;

-- 3. REFERRAL CODES
DROP POLICY IF EXISTS "Anyone can lookup referral codes" ON public.referral_codes;

CREATE OR REPLACE FUNCTION public.lookup_referral_code(_code text)
RETURNS TABLE(user_role text, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT rc.user_role, p.display_name
  FROM public.referral_codes rc
  LEFT JOIN public.profiles p ON p.id = rc.user_id
  WHERE rc.code = _code
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_referral_code(text) TO anon, authenticated;
