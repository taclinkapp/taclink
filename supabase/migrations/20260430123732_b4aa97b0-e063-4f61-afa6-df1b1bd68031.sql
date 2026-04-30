
CREATE OR REPLACE FUNCTION public.apply_instructor_forfeit_on_refund()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_instructor uuid;
BEGIN
  IF NEW.status <> 'issued' THEN RETURN NEW; END IF;
  IF NEW.refund_reason_category NOT IN ('instructor_no_show','instructor_cancel','fraud_safety') THEN RETURN NEW; END IF;
  IF COALESCE(NEW.instructor_forfeit_cents, 0) <= 0 THEN RETURN NEW; END IF;

  UPDATE public.bookings
     SET escrow_status = 'forfeited',
         deposit_status = 'forfeited',
         updated_at = now()
   WHERE id = NEW.booking_id;

  SELECT c.instructor_id INTO v_instructor
    FROM public.courses c JOIN public.bookings b ON b.course_id = c.id
   WHERE b.id = NEW.booking_id;

  IF v_instructor IS NOT NULL THEN
    PERFORM public.award_strike(
      v_instructor,
      CASE WHEN NEW.refund_reason_category = 'fraud_safety' THEN 2 ELSE 1 END
    );
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_instructor::text,
      'deposit_forfeited',
      'Deposit forfeited',
      'A refund was issued. Your $' || to_char(NEW.instructor_forfeit_cents / 100.0, 'FM999990.00') ||
        ' deposit has been refunded to the student.',
      '/instructor/dashboard'
    );
  END IF;
  RETURN NEW;
END;
$function$;
