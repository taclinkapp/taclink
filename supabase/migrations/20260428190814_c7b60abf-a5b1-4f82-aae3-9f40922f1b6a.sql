-- Instructor service area + categories
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS service_state text,
  ADD COLUMN IF NOT EXISTS service_city text,
  ADD COLUMN IF NOT EXISTS service_categories text[] DEFAULT '{}'::text[];

-- Credentials table
CREATE TABLE IF NOT EXISTS public.instructor_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL,
  credential_type text NOT NULL, -- 'nra_instructor' | 'state_license' | 'military_id' | 'le_id' | 'usconcealed' | 'other'
  display_name text,             -- user-provided label
  file_path text NOT NULL,       -- path inside `credentials` bucket
  file_mime text,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'needs_review' | 'rejected'
  ai_confidence numeric,         -- 0..1
  ai_issuer text,
  ai_holder_name text,
  ai_expires_on date,
  ai_reasons text,
  ai_raw jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instructor_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors view their own credentials"
  ON public.instructor_credentials FOR SELECT
  TO authenticated
  USING (auth.uid() = instructor_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Instructors insert their own credentials"
  ON public.instructor_credentials FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = instructor_id);

CREATE POLICY "Instructors update their own credentials"
  ON public.instructor_credentials FOR UPDATE
  TO authenticated
  USING (auth.uid() = instructor_id OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (auth.uid() = instructor_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Instructors delete their own credentials"
  ON public.instructor_credentials FOR DELETE
  TO authenticated
  USING (auth.uid() = instructor_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER set_instructor_credentials_updated_at
BEFORE UPDATE ON public.instructor_credentials
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_credentials_instructor ON public.instructor_credentials(instructor_id, created_at DESC);

-- Private bucket for credential files
INSERT INTO storage.buckets (id, name, public)
VALUES ('credentials', 'credentials', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS — files live under `<instructorId>/<filename>`
CREATE POLICY "Instructors read their own credential files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'credentials'
    AND (auth.uid()::text = (storage.foldername(name))[1]
         OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );

CREATE POLICY "Instructors upload their own credential files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'credentials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Instructors update their own credential files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'credentials'
    AND (auth.uid()::text = (storage.foldername(name))[1]
         OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );

CREATE POLICY "Instructors delete their own credential files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'credentials'
    AND (auth.uid()::text = (storage.foldername(name))[1]
         OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );