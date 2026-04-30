CREATE OR REPLACE FUNCTION public.instructor_cancel_course(_course_id uuid, _reason text DEFAULT NULL)
RETURNS TABLE(
  course_id uuid,
  hours_before_start numeric,
  was_timely boolean,
  bookings_refunded integer,
  total_refunded_cents integer,
  instructor_forfeited_cents integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course record;
  v_caller uuid := auth.uid();
  v_hours numeric;
  v_timely boolean;
  v_reason_cat text;
  v_booking record;
  v_refund_amount integer;
  v_count integer := 0;
  v_total integer := 0;
  v_forfeited integer := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, instructor_id, starts_at, status, title
    INTO v_course
    FROM public.courses
   WHERE id = _course_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  IF v_course.instructor_id <> v_caller AND NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only the course instructor can cancel this course';
  END IF;

  IF v_course.status = 'cancelled' THEN
    RAISE EXCEPTION 'Course is already cancelled';
  END IF;

  IF v_course.starts_at IS NULL THEN
    v_hours := NULL;
    v_timely := true; -- no start time set → treat as timely
  ELSE
    v_hours := EXTRACT(EPOCH FROM (v_course.starts_at - now())) / 3600.0;
    v_timely := v_hours >= 48;
  END IF;

  v_reason_cat := CASE WHEN v_timely THEN 'instructor_cancel_timely' ELSE 'instructor_cancel' END;

  -- Iterate active bookings and issue a full refund to each student
  FOR v_booking IN
    SELECT id, student_id, platform_fee_cents, deposit_amount_cents, escrow_status, online_total_cents
      FROM public.bookings
     WHERE course_id = _course_id
       AND status NOT IN ('cancelled')
  LOOP
    v_refund_amount := COALESCE(v_booking.platform_fee_cents, 0) + COALESCE(v_booking.deposit_amount_cents, 0);
    IF v_refund_amount <= 0 THEN
      v_refund_amount := COALESCE(v_booking.online_total_cents, 0);
    END IF;

    IF v_refund_amount > 0 THEN
      INSERT INTO public.refunds (
        booking_id, student_id, issued_by, amount_cents, refund_type, reason,
        status, refund_reason_category, instructor_forfeit_cents,
        student_cash_refund_cents, refund_method, hours_before_course,
        notes, auto_issued
      ) VALUES (
        v_booking.id, v_booking.student_id, v_caller, v_refund_amount, 'full',
        COALESCE(_reason, 'Course cancelled by instructor'),
        'issued', v_reason_cat,
        CASE WHEN v_timely THEN 0 ELSE COALESCE(v_booking.deposit_amount_cents, 0) END,
        v_refund_amount, 'stripe_cash', v_hours,
        CASE WHEN v_timely
          THEN 'Instructor cancelled ≥48h before start — full refund, no forfeit.'
          ELSE 'Instructor cancelled <48h before start — full refund + deposit forfeit.' END,
        false
      );

      v_total := v_total + v_refund_amount;
      IF NOT v_timely THEN
        v_forfeited := v_forfeited + COALESCE(v_booking.deposit_amount_cents, 0);
      END IF;
    END IF;

    -- Cancel booking + release escrow back to student path
    UPDATE public.bookings
       SET status = 'cancelled',
           escrow_status = CASE
             WHEN v_timely AND escrow_status = 'held' THEN 'refunded'
             WHEN NOT v_timely THEN escrow_status -- forfeit trigger will set to 'forfeited'
             ELSE escrow_status END,
           deposit_status = CASE
             WHEN v_timely THEN 'refunded'
             ELSE deposit_status END,
           updated_at = now()
     WHERE id = v_booking.id;

    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_booking.student_id::text,
      'course_cancelled',
      'Course cancelled — refund issued',
      'Your instructor cancelled "' || v_course.title || '". A full refund of $' ||
        to_char(v_refund_amount / 100.0, 'FM999990.00') || ' has been issued.',
      '/student/bookings'
    );
    v_count := v_count + 1;
  END LOOP;

  -- Mark the course cancelled
  UPDATE public.courses
     SET status = 'cancelled', updated_at = now()
   WHERE id = _course_id;

  -- Instructor-side notification
  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (
    v_course.instructor_id::text,
    CASE WHEN v_timely THEN 'course_cancel_timely' ELSE 'course_cancel_late' END,
    CASE WHEN v_timely THEN 'Course cancelled — deposit returned'
         ELSE 'Course cancelled — deposit forfeited' END,
    CASE WHEN v_timely
      THEN 'You cancelled "' || v_course.title || '" with 48+ hours notice. Students were refunded and your deposit was released.'
      ELSE 'You cancelled "' || v_course.title || '" with less than 48 hours notice. Students were refunded and your deposit was forfeited. A strike was added to your account.' END,
    '/instructor/dashboard'
  );

  RETURN QUERY SELECT _course_id, v_hours, v_timely, v_count, v_total, v_forfeited;
END;
$$;

GRANT EXECUTE ON FUNCTION public.instructor_cancel_course(uuid, text) TO authenticated;

-- Make sure the forfeit trigger recognises the new "timely" category as a no-op
CREATE OR REPLACE FUNCTION public.apply_instructor_forfeit_on_refund()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    VALUES (v_instructor::text, 'deposit_forfeited', 'Deposit forfeited',
      'A refund was issued. Your $' || to_char(NEW.instructor_forfeit_cents / 100.0, 'FM999990.00') ||
      ' deposit has been refunded to the student.',
      '/instructor/dashboard');
  END IF;
  RETURN NEW;
END;
$$;