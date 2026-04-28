-- Prevent students from changing the rating after a review is submitted.
CREATE OR REPLACE FUNCTION public.prevent_review_rating_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admins to override (e.g. moderation corrections)
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.rating IS DISTINCT FROM OLD.rating THEN
    RAISE EXCEPTION 'Rating cannot be changed after a review is submitted'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_review_rating ON public.reviews;
CREATE TRIGGER lock_review_rating
  BEFORE UPDATE OF rating ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_review_rating_change();