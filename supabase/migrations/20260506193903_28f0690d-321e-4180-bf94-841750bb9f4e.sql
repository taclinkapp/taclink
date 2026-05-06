ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS gallery_urls text[] NOT NULL DEFAULT '{}'::text[];

-- Cap at 8 photos to keep the UX consistent with the instructor-side picker.
ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_gallery_urls_max_8;
ALTER TABLE public.courses
  ADD CONSTRAINT courses_gallery_urls_max_8
  CHECK (cardinality(gallery_urls) <= 8);