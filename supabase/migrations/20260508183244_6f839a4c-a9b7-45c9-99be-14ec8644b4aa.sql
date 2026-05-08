
INSERT INTO storage.buckets (id, name, public)
VALUES ('background-videos', 'background-videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Background videos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'background-videos');

CREATE POLICY "Admins can upload background videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'background-videos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update background videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'background-videos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete background videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'background-videos' AND public.has_role(auth.uid(), 'admin'));
