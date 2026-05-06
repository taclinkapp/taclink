-- 1) Re-scope same-course uniqueness so cancelled bookings don't block rebooking.
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_student_id_course_id_key;
DROP INDEX IF EXISTS public.bookings_student_id_course_id_key;

CREATE UNIQUE INDEX bookings_active_student_course_uidx
  ON public.bookings (student_id, course_id)
  WHERE status <> 'cancelled';

-- 2) Block overlapping time-slot bookings for the same student on different courses.
CREATE OR REPLACE FUNCTION public.prevent_overlapping_bookings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_start TIMESTAMPTZ;
  new_end   TIMESTAMPTZ;
  conflict_title TEXT;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT starts_at, ends_at INTO new_start, new_end
  FROM public.courses WHERE id = NEW.course_id;

  -- If the new course has no schedule, nothing to check.
  IF new_start IS NULL OR new_end IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.title INTO conflict_title
  FROM public.bookings b
  JOIN public.courses c ON c.id = b.course_id
  WHERE b.student_id = NEW.student_id
    AND b.id <> NEW.id
    AND b.status <> 'cancelled'
    AND c.starts_at IS NOT NULL
    AND c.ends_at IS NOT NULL
    AND tstzrange(c.starts_at, c.ends_at, '[)') &&
        tstzrange(new_start, new_end, '[)')
  LIMIT 1;

  IF conflict_title IS NOT NULL THEN
    RAISE EXCEPTION
      'You already have an active booking that overlaps this time slot (conflicts with: %)',
      conflict_title
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_overlapping_bookings_trg ON public.bookings;
CREATE TRIGGER prevent_overlapping_bookings_trg
  BEFORE INSERT OR UPDATE OF course_id, status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_overlapping_bookings();