
-- Make the public instructor view caller-scoped (no definer powers)
ALTER VIEW public.public_instructor_profiles SET (security_invoker = true);

-- Re-grant a tiny public read on profiles so the view works for anyone,
-- but ONLY restoring rows that already have a course. Other policies still
-- cover own-profile and admin reads.
CREATE POLICY "Public instructor row read (safe cols via view)"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.instructor_id = profiles.id));

-- NOTE: callers must use public_instructor_profiles (safe cols) rather than
-- selecting * from profiles. Application code is being updated accordingly.

-- Affiliate owner view: caller-scoped + restore a narrow owner SELECT policy
ALTER VIEW public.affiliate_my_link SET (security_invoker = true);

CREATE POLICY "Owners read own influencer link (safe cols via view)"
  ON public.influencer_links
  FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());
