CREATE POLICY "Owners can read own influencer link"
ON public.influencer_links
FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());