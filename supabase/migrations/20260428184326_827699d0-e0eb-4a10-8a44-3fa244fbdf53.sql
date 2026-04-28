-- Public storage bucket for instructor-uploaded course cover photos.
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-photos', 'course-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (course photos are shown on the public discover/listing pages).
CREATE POLICY "Course photos are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'course-photos');

-- Authenticated instructors may upload into a folder named by their user id.
CREATE POLICY "Instructors can upload their own course photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Instructors can update their own course photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'course-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Instructors can delete their own course photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
