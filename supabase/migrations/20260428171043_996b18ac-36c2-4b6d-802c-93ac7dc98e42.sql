-- Add photo support to reviews
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS photo_url text;

-- Create public bucket for review photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-photos', 'review-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, students manage their own folder
CREATE POLICY "Review photos are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'review-photos');

CREATE POLICY "Students can upload their own review photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'review-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Students can update their own review photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'review-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Students can delete their own review photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'review-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );