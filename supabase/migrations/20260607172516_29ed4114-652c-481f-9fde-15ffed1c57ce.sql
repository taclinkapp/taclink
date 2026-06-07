
-- 1. Reviews: remove public read access; restrict to authenticated users only
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;

CREATE POLICY "Authenticated users can view reviews"
ON public.reviews
FOR SELECT
TO authenticated
USING (true);

-- 2. bypass_attempts: restrict INSERT to authenticated users and enforce user_id = auth.uid()
DROP POLICY IF EXISTS "Authenticated users can log their own attempts" ON public.bypass_attempts;

CREATE POLICY "Authenticated users can log their own attempts"
ON public.bypass_attempts
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 3. conversations: revoke anon table-level privileges so Realtime cannot leak rows to anon connections
REVOKE ALL ON public.conversations FROM anon;
