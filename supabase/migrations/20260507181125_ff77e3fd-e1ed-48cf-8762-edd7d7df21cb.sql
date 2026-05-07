CREATE OR REPLACE FUNCTION public.instructor_cancel_course(_course_id uuid, _reason text DEFAULT NULL::text)
 RETURNS TABLE(course_id uuid, hours_before_start numeric, was_timely boolean, bookings_refunded integer, total_refunded_cents integer, instructor_forfeited_cents integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT c.id, c.instructor_id, c.starts_at, c.status, c.title
    INTO v_course
    FROM public.courses c
   WHERE c.id = _course_id
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
    v_timely := true;
  ELSE
    v_hours := EXTRACT(EPOCH FROM (v_course.starts_at - now())) / 3600.0;
    v_timely := v_hours >= 48;
  END IF;

  v_reason_cat := CASE WHEN v_timely THEN 'instructor_cancel_timely' ELSE 'instructor_cancel' END;

  FOR v_booking IN
    SELECT b.id, b.student_id, b.platform_fee_cents, b.deposit_amount_cents,
           b.course_price_cents, b.escrow_status, b.online_total_cents
      FROM public.bookings b
     WHERE b.course_id = _course_id
       AND b.status NOT IN ('cancelled')
  LOOP
    v_refund_amount := COALESCE(v_booking.online_total_cents,
                                COALESCE(v_booking.platform_fee_cents, 2500)
                                  + COALESCE(v_booking.course_price_cents, 0));

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
        COALESCE(v_booking.course_price_cents, 0),
        v_refund_amount, 'stripe_cash', v_hours,
        CASE WHEN v_timely
          THEN 'Instructor cancelled ≥48h before start — full refund.'
          ELSE 'Instructor cancelled <48h before start — full refund + strike.' END,
        false
      );

      v_total := v_total + v_refund_amount;
      IF NOT v_timely THEN
        v_forfeited := v_forfeited + COALESCE(v_booking.course_price_cents, 0);
      END IF;
    END IF;

    UPDATE public.bookings
       SET status = 'cancelled',
           escrow_status = CASE
             WHEN escrow_status = 'held' THEN 'refunded'
             ELSE escrow_status END,
           deposit_status = 'refunded',
           updated_at = now()
     WHERE id = v_booking.id;

    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_booking.student_id::text,
      'course_cancelled',
      'Course cancelled — full refund issued',
      'Your instructor cancelled "' || v_course.title || '". A full refund of $' ||
        to_char(v_refund_amount / 100.0, 'FM999990.00') || ' has been issued to your card.',
      '/student/bookings'
    );
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.courses
     SET status = 'cancelled', updated_at = now()
   WHERE id = _course_id;

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (
    v_course.instructor_id::text,
    CASE WHEN v_timely THEN 'course_cancel_timely' ELSE 'course_cancel_late' END,
    CASE WHEN v_timely THEN 'Course cancelled' ELSE 'Course cancelled — strike added' END,
    CASE WHEN v_timely
      THEN 'You cancelled "' || v_course.title || '" with 48+ hours notice. Students were fully refunded.'
      ELSE 'You cancelled "' || v_course.title || '" with less than 48 hours notice. Students were fully refunded and a strike was added to your account.' END,
    '/instructor/dashboard'
  );

  RETURN QUERY SELECT _course_id, v_hours, v_timely, v_count, v_total, v_forfeited;
END;
$function$;