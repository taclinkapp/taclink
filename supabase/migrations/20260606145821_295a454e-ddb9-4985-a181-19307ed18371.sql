-- Restrict platform_settings reads to admins only.
-- The only client reads are from admin pages (useAdminData, AdminInfluencerLinks).
-- Edge functions use the service_role key and bypass RLS, so this does not affect them.
DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;

CREATE POLICY "Admins can read platform settings"
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE SELECT ON public.platform_settings FROM anon;