-- Tiered student cancellation grace period based on lead time at booking.
-- Replaces the flat 48h default with a tier derived from (course.starts_at - booking.booked_at).
--
-- Tiers:
--   lead >= 7 days  -> 72h grace
--   lead >= 3 days  -> 48h grace
--   lead >= 1 day   -> 24h grace
--   lead <  1 day   -> 0h  (no grace; any cancel is "late")
--
-- The grace deadline = LEAST(booked_at + cutoff_hours, course.starts_at).

CREATE OR REPLACE FUNCTION public.compute_cancel_cutoff_hours(_starts_at timestamptz, _booked_at timestamptz)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _starts_at IS NULL OR _booked_at IS NULL THEN 48
    WHEN EXTRACT(EPOCH FROM (_starts_at - _booked_at)) / 3600.0 >= 168 THEN 72
    WHEN EXTRACT(EPOCH FROM (_starts_at - _booked_at)) / 3600.0 >= 72  THEN 48
    WHEN EXTRACT(EPOCH FROM (_starts_at - _booked_at)) / 3600.0 >= 24  THEN 24
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.set_booking_cancel_cutoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_starts_at timestamptz;
BEGIN
  SELECT starts_at INTO v_starts_at FROM public.courses WHERE id = NEW.course_id;
  NEW.cancellation_cutoff_hours := public.compute_cancel_cutoff_hours(v_starts_at, COALESCE(NEW.booked_at, now()));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_booking_cancel_cutoff ON public.bookings;
CREATE TRIGGER trg_set_booking_cancel_cutoff
BEFORE INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.set_booking_cancel_cutoff();

-- Backfill existing bookings using their booked_at + course starts_at.
UPDATE public.bookings b
SET cancellation_cutoff_hours = public.compute_cancel_cutoff_hours(c.starts_at, b.booked_at)
FROM public.courses c
WHERE c.id = b.course_id;