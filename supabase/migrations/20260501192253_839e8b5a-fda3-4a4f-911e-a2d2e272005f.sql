
-- 1. MESSAGES: prevent sender impersonation
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can send messages as themselves" ON public.messages;

CREATE POLICY "Participants can send messages as themselves"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND (c.student_id = auth.uid()::text OR c.instructor_id = auth.uid()::text)
  )
);

-- 2. PROFILES: restrict cross-user reads to safe view
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own full profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own full profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE VIEW public.profiles_public AS
SELECT id, display_name, photo_url, bio, service_city, service_state, service_categories, created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated, anon;

-- 3. INFLUENCER LINKS: hide email/notes from public
DROP POLICY IF EXISTS "Anyone can view influencer links" ON public.influencer_links;
DROP POLICY IF EXISTS "Public can view influencer links" ON public.influencer_links;
DROP POLICY IF EXISTS "influencer_links_select_public" ON public.influencer_links;
DROP POLICY IF EXISTS "Owners and admins read full influencer link" ON public.influencer_links;

CREATE POLICY "Owners and admins read full influencer link"
ON public.influencer_links FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE VIEW public.influencer_links_public AS
SELECT id, slug, influencer_name, influencer_handle, audience, commission_pct, active, created_at
FROM public.influencer_links
WHERE active = true;

GRANT SELECT ON public.influencer_links_public TO anon, authenticated;

-- 4. REFERRAL CODES: hide UUIDs/roles from anonymous
DROP POLICY IF EXISTS "Anyone can view referral codes" ON public.referral_codes;
DROP POLICY IF EXISTS "Public can view referral codes" ON public.referral_codes;
DROP POLICY IF EXISTS "referral_codes_select_public" ON public.referral_codes;
DROP POLICY IF EXISTS "Owners and admins read referral codes" ON public.referral_codes;

CREATE POLICY "Owners and admins read referral codes"
ON public.referral_codes FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.referral_code_exists(_code text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.referral_codes WHERE code = _code); $$;

GRANT EXECUTE ON FUNCTION public.referral_code_exists(text) TO anon, authenticated;
