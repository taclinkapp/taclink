CREATE OR REPLACE FUNCTION public.tg_award_five_star_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_booking_id uuid;
BEGIN
  IF NEW.rating = 5 THEN
    SELECT id INTO v_booking_id
      FROM public.bookings
     WHERE student_id = NEW.student_id
       AND course_id = NEW.course_id
     ORDER BY booked_at DESC
     LIMIT 1;

    IF v_booking_id IS NOT NULL THEN
      UPDATE public.student_xp_awards
         SET bonus_five_star = 10,
             xp = xp - bonus_five_star + 10,
             updated_at = now()
       WHERE booking_id = v_booking_id
         AND bonus_five_star = 0;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;