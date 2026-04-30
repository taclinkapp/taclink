
-- 1) profiles: restrict public SELECT to authenticated users only
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 2) cockpit_briefs: only service role can insert/update; remove anon-accessible policies
DROP POLICY IF EXISTS "Service inserts briefs" ON public.cockpit_briefs;
DROP POLICY IF EXISTS "Service updates briefs" ON public.cockpit_briefs;

CREATE POLICY "Service role inserts briefs"
ON public.cockpit_briefs
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role updates briefs"
ON public.cockpit_briefs
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- 3) ai_actions: only service role can insert
DROP POLICY IF EXISTS "Service can insert ai_actions" ON public.ai_actions;

CREATE POLICY "Service role inserts ai_actions"
ON public.ai_actions
FOR INSERT
TO service_role
WITH CHECK (true);
