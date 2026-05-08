-- Backfill profile photo_url for users whose photo was uploaded to storage
-- but never persisted to the profiles row (legacy bug where the upload UI
-- only updated local form state). Picks the most recent uploaded avatar
-- per user folder.
WITH latest AS (
  SELECT DISTINCT ON (split_part(name, '/', 1))
    split_part(name, '/', 1)::uuid AS user_id,
    name AS path
  FROM storage.objects
  WHERE bucket_id = 'profile-photos'
  ORDER BY split_part(name, '/', 1), created_at DESC
)
UPDATE public.profiles p
SET photo_url = 'https://jocnlpkbaqmriedmbocl.supabase.co/storage/v1/object/public/profile-photos/' || l.path
FROM latest l
WHERE p.id = l.user_id
  AND (p.photo_url IS NULL OR p.photo_url = '');