CREATE POLICY "Public can view instructor profiles"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.courses c WHERE c.instructor_id = profiles.id
  )
);

-- ============ Reliability resolutions ============
CREATE TABLE IF NOT EXISTS public.route_404_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  resolved_by uuid,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  release_id text
);

ALTER TABLE public.route_404_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read 404 resolutions"
ON public.route_404_resolutions
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert 404 resolutions"
ON public.route_404_resolutions
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND resolved_by = auth.uid());

CREATE POLICY "Admins update 404 resolutions"
ON public.route_404_resolutions
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete 404 resolutions"
ON public.route_404_resolutions
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
