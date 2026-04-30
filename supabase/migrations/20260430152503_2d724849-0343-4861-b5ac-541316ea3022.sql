-- =====================================================================
-- No-show + student-cancel refund RPCs
-- All three wrap compute_refund_split() so the 90/10 + $25 policy is
-- the single source of truth, then write the refunds row (which fires
-- existing triggers: instructor strike, deposit forfeit, etc.) and
-- update the booking status.
-- =====================================================================

-- 1) STUDENT NO-SHOW (instructor reports the student didn't show up)
--    Treated as student_cancel_late: student gets 90% of course price,
--    instructor keeps 10%, TacLink keeps the $25 platform fee.
CREATE OR REPLACE FUNCTION public.student_no_show_refund(
  _booking_id uuid,
  _reason text DEFAULT 'Student did not show up at the course'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_b record;
  v_split record;
  v_refund_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT b.id, b.student_id, b.status, b.course_id, b.online_total_cents,
         b.platform_fee_cents, b.course_price_cents, c.instructor_id, c.title
    INTO v_b
    FROM public.bookings b JOIN public.courses c ON c.id = b.course_id
   WHERE b.id = _booking_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF v_b.instructor_id <> v_caller AND NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only the course instructor can mark a student no-show';
  END IF;

  IF v_b.status IN ('attended', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot mark no-show on a % booking', v_b.status;
  END IF;

  SELECT * INTO v_split
    FROM public.compute_refund_split(_booking_id, 'student_cancel_late');

  -- Issue partial refund (90% of course price). Trigger handles strike/forfeit.
  IF COALESCE(v_split.student_cash_refund_cents, 0) > 0 THEN
    INSERT INTO public.refunds (
      booking_id, student_id, issued_by, amount_cents, refund_type, reason,
      status, refund_reason_category, instructor_forfeit_cents,
      student_cash_refund_cents, platform_absorbed_cents,
      refund_method, hours_before_course, notes, auto_issued
    ) VALUES (
      _booking_id, v_b.student_id, v_caller,
      v_split.student_cash_refund_cents, 'partial', _reason,
      'issued', 'student_cancel_late',
      COALESCE(v_split.instructor_forfeit_cents, 0),
      v_split.student_cash_refund_cents,
      COALESCE(v_split.platform_absorbed_cents, 0),
      'stripe_cash', v_split.hours_before_course,
      'Instructor reported student no-show — ' || v_split.rationale, false
    ) RETURNING id INTO v_refund_id;
  END IF;

  UPDATE public.bookings
     SET status = 'no_show',
         updated_at = now()
   WHERE id = _booking_id;

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (
    v_b.student_id::text,
    'no_show_refund',
    'You were marked as a no-show',
    'Your instructor reported you did not attend "' || v_b.title || '". A 90% refund of the course price ($' ||
      to_char(COALESCE(v_split.student_cash_refund_cents,0) / 100.0, 'FM999990.00') ||
      ') has been issued to your card. The instructor keeps 10% and TacLink retains the $25 platform fee.',
    '/student/booking/' || _booking_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'refund_id', v_refund_id,
    'student_refund_cents', COALESCE(v_split.student_cash_refund_cents, 0),
    'instructor_kept_cents', COALESCE(v_split.instructor_forfeit_cents, 0),
    'rationale', v_split.rationale
  );
END;
$$;

-- 2) INSTRUCTOR NO-SHOW (student or admin reports the instructor didn't show)
--    Routes through compute_refund_split('instructor_no_show'):
--    student gets 100% back ($25 + course price), instructor gets nothing,
--    deposit-forfeit trigger adds a strike automatically.
CREATE OR REPLACE FUNCTION public.instructor_no_show_refund(
  _booking_id uuid,
  _reason text DEFAULT 'Instructor did not show up at the course'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_b record;
  v_split record;
  v_refund_id uuid;
  v_is_admin boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_is_admin := public.has_role(v_caller, 'admin'::app_role);

  SELECT b.id, b.student_id, b.status, b.course_id, b.online_total_cents,
         b.platform_fee_cents, b.course_price_cents, c.instructor_id, c.title
    INTO v_b
    FROM public.bookings b JOIN public.courses c ON c.id = b.course_id
   WHERE b.id = _booking_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  -- Allow: the affected student, or admin
  IF v_b.student_id <> v_caller AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Only the affected student or an admin can report instructor no-show';
  END IF;

  IF v_b.status IN ('cancelled') THEN
    RAISE EXCEPTION 'Booking is already cancelled';
  END IF;

  SELECT * INTO v_split
    FROM public.compute_refund_split(_booking_id, 'instructor_no_show');

  INSERT INTO public.refunds (
    booking_id, student_id, issued_by, amount_cents, refund_type, reason,
    status, refund_reason_category, instructor_forfeit_cents,
    student_cash_refund_cents, platform_absorbed_cents,
    refund_method, hours_before_course, notes, auto_issued
  ) VALUES (
    _booking_id, v_b.student_id, v_caller,
    v_split.student_cash_refund_cents, 'full', _reason,
    'issued', 'instructor_no_show',
    COALESCE(v_split.instructor_forfeit_cents, 0),
    v_split.student_cash_refund_cents,
    COALESCE(v_split.platform_absorbed_cents, 0),
    'stripe_cash', v_split.hours_before_course,
    'Instructor no-show — full cash refund + strike. ' || v_split.rationale, false
  ) RETURNING id INTO v_refund_id;

  UPDATE public.bookings
     SET status = 'cancelled',
         escrow_status = CASE WHEN escrow_status = 'held' THEN 'refunded' ELSE escrow_status END,
         deposit_status = 'refunded',
         updated_at = now()
   WHERE id = _booking_id;

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (
    v_b.instructor_id::text, 'instructor_no_show_strike',
    'Strike: instructor no-show reported',
    'A no-show was reported for "' || v_b.title || '". The student was fully refunded and a strike was added to your account.',
    '/instructor/dashboard'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'refund_id', v_refund_id,
    'student_refund_cents', v_split.student_cash_refund_cents,
    'rationale', v_split.rationale
  );
END;
$$;

-- 3) STUDENT-INITIATED CANCEL
--    Auto-classifies timely vs late based on the booking's grace window
--    via compute_refund_split(_reason := 'student_cancel').
CREATE OR REPLACE FUNCTION public.student_cancel_booking(
  _booking_id uuid,
  _reason text DEFAULT 'Cancelled by student'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_b record;
  v_split record;
  v_refund_id uuid;
  v_refund_type text;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT b.id, b.student_id, b.status, b.course_id, b.online_total_cents,
         b.platform_fee_cents, b.course_price_cents, c.instructor_id, c.title, c.starts_at
    INTO v_b
    FROM public.bookings b JOIN public.courses c ON c.id = b.course_id
   WHERE b.id = _booking_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF v_b.student_id <> v_caller AND NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only the booking owner can cancel';
  END IF;

  IF v_b.status <> 'reserved' THEN
    RAISE EXCEPTION 'Cannot cancel a % booking', v_b.status;
  END IF;

  -- Let compute_refund_split auto-classify timely vs late
  SELECT * INTO v_split
    FROM public.compute_refund_split(_booking_id, 'student_cancel');

  v_refund_type := CASE
    WHEN v_split.reason_category = 'student_cancel_timely' THEN 'full'
    ELSE 'partial'
  END;

  IF COALESCE(v_split.student_cash_refund_cents, 0) > 0 THEN
    INSERT INTO public.refunds (
      booking_id, student_id, issued_by, amount_cents, refund_type, reason,
      status, refund_reason_category, instructor_forfeit_cents,
      student_cash_refund_cents, platform_absorbed_cents,
      refund_method, hours_before_course, notes, auto_issued
    ) VALUES (
      _booking_id, v_b.student_id, v_caller,
      v_split.student_cash_refund_cents, v_refund_type, _reason,
      'issued', v_split.reason_category,
      COALESCE(v_split.instructor_forfeit_cents, 0),
      v_split.student_cash_refund_cents,
      COALESCE(v_split.platform_absorbed_cents, 0),
      'stripe_cash', v_split.hours_before_course,
      'Student-initiated cancel — ' || v_split.rationale, false
    ) RETURNING id INTO v_refund_id;
  END IF;

  UPDATE public.bookings
     SET status = 'cancelled',
         escrow_status = CASE WHEN escrow_status = 'held' THEN 'refunded' ELSE escrow_status END,
         deposit_status = CASE WHEN v_split.reason_category = 'student_cancel_timely'
                               THEN 'refunded' ELSE deposit_status END,
         updated_at = now()
   WHERE id = _booking_id;

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (
    v_b.instructor_id::text, 'student_cancelled',
    CASE WHEN v_split.reason_category = 'student_cancel_timely'
         THEN 'A student cancelled (within grace window)'
         ELSE 'A student cancelled late — you keep 10%' END,
    'A student cancelled their booking for "' || v_b.title || '". ' ||
      CASE WHEN v_split.reason_category = 'student_cancel_late'
           THEN 'You keep 10% of the course price ($' ||
                to_char(COALESCE(v_split.instructor_forfeit_cents,0) / 100.0, 'FM999990.00') ||
                ') as compensation for the lost slot.'
           ELSE 'They were within their grace window — full refund issued, no payout for this booking.' END,
    '/instructor/roster'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'refund_id', v_refund_id,
    'reason_category', v_split.reason_category,
    'student_refund_cents', COALESCE(v_split.student_cash_refund_cents, 0),
    'instructor_kept_cents', COALESCE(v_split.instructor_forfeit_cents, 0),
    'rationale', v_split.rationale
  );
END;
$$;

-- Grant execute to authenticated users (security is enforced inside each function)
GRANT EXECUTE ON FUNCTION public.student_no_show_refund(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.instructor_no_show_refund(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_cancel_booking(uuid, text) TO authenticated;