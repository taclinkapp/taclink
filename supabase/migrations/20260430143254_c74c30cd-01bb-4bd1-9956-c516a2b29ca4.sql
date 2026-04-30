CREATE OR REPLACE FUNCTION public.compute_refund_split(_booking_id uuid, _reason text)
 RETURNS TABLE(student_cash_refund_cents integer, instructor_forfeit_cents integer, platform_absorbed_cents integer, requires_owner boolean, hours_before_course numeric, reason_category text, rationale text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_b record;
  v_hours numeric;
  v_cutoff int;
  v_platform int; v_deposit int;
  v_student int := 0; v_forfeit int := 0; v_absorb int := 0;
  v_owner boolean := false; v_rationale text := '';
BEGIN
  SELECT b.id, b.platform_fee_cents, b.deposit_amount_cents, b.online_total_cents,
         b.escrow_status, b.booked_at, b.cancellation_cutoff_hours,
         c.starts_at
    INTO v_b
    FROM public.bookings b JOIN public.courses c ON c.id = b.course_id
   WHERE b.id = _booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found: %', _booking_id; END IF;

  v_platform := COALESCE(v_b.platform_fee_cents, 2500);
  v_deposit  := COALESCE(v_b.deposit_amount_cents, 0);
  v_cutoff   := COALESCE(v_b.cancellation_cutoff_hours,
                         public.compute_cancel_cutoff_hours(v_b.starts_at, v_b.booked_at));

  IF v_b.starts_at IS NOT NULL THEN
    v_hours := EXTRACT(EPOCH FROM (v_b.starts_at - now())) / 3600.0;
  END IF;

  -- Auto-classify generic student_cancel using the booking's stored grace window.
  IF _reason IN ('student_cancel','student_cancel_unspecified') OR _reason IS NULL THEN
    IF v_cutoff > 0 AND v_hours IS NOT NULL
       AND v_hours >= (EXTRACT(EPOCH FROM (v_b.starts_at - v_b.booked_at)) / 3600.0) - v_cutoff THEN
      _reason := 'student_cancel_timely';
    ELSE
      _reason := 'student_cancel_late';
    END IF;
  END IF;

  CASE _reason
    WHEN 'instructor_no_show', 'instructor_cancel' THEN
      v_student := v_platform + v_deposit; v_forfeit := v_deposit;
      v_rationale := 'Instructor at fault — full cash refund ($25 + 10%) to student. Instructor forfeits deposit.';
    WHEN 'fraud_safety' THEN
      v_student := v_platform + v_deposit; v_forfeit := v_deposit; v_owner := true;
      v_rationale := 'Fraud/safety incident — full cash refund + owner review + instructor strike.';
    WHEN 'student_cancel_timely' THEN
      v_student := v_platform + v_deposit;
      v_rationale := format(
        'Student cancelled within their %sh grace window — full cash refund ($25 + 10%% deposit). Instructor receives no payout for this booking.',
        v_cutoff
      );
    WHEN 'student_cancel_late' THEN
      v_rationale := format(
        'Student cancelled after the %sh grace window — no refund. Instructor keeps the 10%% deposit (released 24h after course).',
        v_cutoff
      );
    WHEN 'weather_reschedule' THEN
      v_rationale := 'Weather/mutual reschedule — no refund; reschedule the booking instead.';
    WHEN 'quality_complaint' THEN
      v_student := v_platform; v_absorb := v_platform; v_owner := true;
      v_rationale := 'Quality complaint — owner review required. Goodwill cash refund of platform fee absorbed by TacLink.';
    WHEN 'chargeback_threat' THEN
      v_owner := true;
      v_rationale := 'Chargeback/legal threat — escalated to owner.';
    ELSE
      v_owner := true;
      v_rationale := 'Unknown reason — escalated to owner.';
  END CASE;

  RETURN QUERY SELECT v_student, v_forfeit, v_absorb, v_owner, v_hours, _reason, v_rationale;
END;
$function$;