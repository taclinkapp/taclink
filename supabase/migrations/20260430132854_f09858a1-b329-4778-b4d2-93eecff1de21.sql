-- Enforce a minimum 7-day lead time for published courses so students have
-- enough time to discover and book the course.
CREATE OR REPLACE FUNCTION public.enforce_course_min_lead_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_lead interval := interval '7 days';
BEGIN
  -- Only enforce when the course is being published (or already published) and has a start time.
  IF NEW.status = 'published' AND NEW.starts_at IS NOT NULL THEN
    -- On INSERT, always check.
    -- On UPDATE, only check if starts_at or status was just changed (avoid blocking
    -- unrelated edits to already-published courses whose start was set before the rule).
    IF TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE' AND (
             NEW.starts_at IS DISTINCT FROM OLD.starts_at
             OR (OLD.status IS DISTINCT FROM 'published' AND NEW.status = 'published')
           ))
    THEN
      IF NEW.starts_at < (now() + v_min_lead) THEN
        RAISE EXCEPTION 'Courses must start at least 7 days from now (got %).', NEW.starts_at
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_course_min_lead_time ON public.courses;
CREATE TRIGGER trg_enforce_course_min_lead_time
BEFORE INSERT OR UPDATE ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.enforce_course_min_lead_time();