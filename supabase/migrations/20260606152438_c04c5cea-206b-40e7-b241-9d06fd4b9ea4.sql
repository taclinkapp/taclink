
CREATE POLICY "Admins can read media-library"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'media-library' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can upload media-library"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'media-library' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update media-library"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'media-library' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete media-library"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'media-library' AND public.has_role(auth.uid(), 'admin'));
