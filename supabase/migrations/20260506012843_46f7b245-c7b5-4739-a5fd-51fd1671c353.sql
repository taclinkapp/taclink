CREATE OR REPLACE FUNCTION public.enforce_test_account_booking_isolation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instructor uuid;
BEGIN
  SELECT instructor_id INTO v_instructor FROM public.courses WHERE id = NEW.course_id;
  IF v_instructor IS NULL THEN RETURN NEW; END IF;

  -- If the course belongs to a fake QA test instructor, only fake QA test
  -- student accounts (or admins) may book it. Real students are blocked even
  -- if they somehow obtain the course id.
  IF public.is_test_account(v_instructor)
     AND NOT public.is_test_account(NEW.student_id)
     AND NOT public.has_role(NEW.student_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'This course is a QA test listing and can only be booked by QA test student accounts.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_test_account_booking_isolation ON public.bookings;
CREATE TRIGGER trg_enforce_test_account_booking_isolation
BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.enforce_test_account_booking_isolation();