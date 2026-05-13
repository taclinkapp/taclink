CREATE OR REPLACE FUNCTION public.get_public_profile_cards(_ids uuid[])
RETURNS TABLE(id uuid, display_name text, photo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.photo_url
  FROM public.profiles p
  WHERE p.id = ANY(_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_cards(uuid[]) TO anon, authenticated;

WITH latest AS (
  SELECT DISTINCT ON (split_part(name, '/', 1))
    split_part(name, '/', 1)::uuid AS user_id,
    name AS path
  FROM storage.objects
  WHERE bucket_id = 'profile-photos'
    AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ORDER BY split_part(name, '/', 1), created_at DESC
)
UPDATE public.profiles p
SET photo_url = 'https://jocnlpkbaqmriedmbocl.supabase.co/storage/v1/object/public/profile-photos/' || l.path,
    updated_at = now()
FROM latest l
WHERE p.id = l.user_id
  AND (p.photo_url IS NULL OR btrim(p.photo_url) = '');