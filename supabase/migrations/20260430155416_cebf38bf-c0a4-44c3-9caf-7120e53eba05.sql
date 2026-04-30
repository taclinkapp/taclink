
-- =====================================================================
-- 1) checkin_attempts: per-scan telemetry feeding the audit view
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.checkin_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  instructor_id uuid NOT NULL,
  booking_id uuid,
  student_id uuid,
  outcome text NOT NULL CHECK (outcome IN (
    'success',
    'already_attended',
    'wrong_course',
    'verification_failed',
    'unsigned_warning',
    'cannot_checkin',
    'pending_proximity',
    'invalid_qr',
    'rpc_error'
  )),
  source text NOT NULL DEFAULT 'qr' CHECK (source IN ('qr','proximity','manual')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkin_attempts_course ON public.checkin_attempts(course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkin_attempts_instructor ON public.checkin_attempts(instructor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkin_attempts_booking ON public.checkin_attempts(booking_id, created_at DESC);

ALTER TABLE public.checkin_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors view their checkin attempts" ON public.checkin_attempts;
CREATE POLICY "Instructors view their checkin attempts"
  ON public.checkin_attempts FOR SELECT
  TO authenticated
  USING (instructor_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage checkin attempts" ON public.checkin_attempts;
CREATE POLICY "Admins manage checkin attempts"
  ON public.checkin_attempts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =====================================================================
-- 2) record_checkin_attempt RPC — clients log scan outcomes through this
--    instead of inserting directly. Server validates instructor ownership.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.record_checkin_attempt(
  _course_id uuid,
  _outcome text,
  _booking_id uuid DEFAULT NULL,
  _source text DEFAULT 'qr',
  _reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_instructor uuid;
  v_student uuid;
  v_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT instructor_id INTO v_instructor FROM public.courses WHERE id = _course_id;
  IF v_instructor IS NULL THEN
    RAISE EXCEPTION 'Course not found';
  END IF;
  IF v_instructor <> v_caller AND NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only the course instructor can log check-in attempts';
  END IF;

  IF _booking_id IS NOT NULL THEN
    SELECT student_id INTO v_student FROM public.bookings WHERE id = _booking_id;
  END IF;

  INSERT INTO public.checkin_attempts (
    course_id, instructor_id, booking_id, student_id, outcome, source, reason
  ) VALUES (
    _course_id, v_instructor, _booking_id, v_student, _outcome,
    COALESCE(_source, 'qr'), _reason
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_checkin_attempt(uuid, text, uuid, text, text) TO authenticated;

-- =====================================================================
-- 3) Helper to write into admin_audit_log from a SECURITY DEFINER RPC
--    without tripping the "admin_id = auth.uid()" RLS check (we use the
--    caller's uid as admin_id when the caller is admin; otherwise we skip
--    because admin_audit_log is admin-only).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.audit_booking_action(
  _action text,
  _booking_id uuid,
  _before jsonb,
  _after jsonb,
  _reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Always write — admin_audit_log is the source of truth even for non-admin
  -- actor-initiated state transitions on bookings (no-show, cancel).
  -- We bypass the RLS WITH CHECK by inserting via SECURITY DEFINER.
  INSERT INTO public.admin_audit_log (
    admin_id, action, target_type, target_id,
    before_value, after_value, reason, source
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    _action, 'booking', _booking_id::text,
    _before, _after, _reason, 'rpc'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.audit_booking_action(text, uuid, jsonb, jsonb, text) TO authenticated;

-- =====================================================================
-- 4) Make the three booking RPCs idempotent + audit-logged.
--    Strategy: use FOR UPDATE row lock (already present), then if the row
--    is already in the terminal state we return the prior outcome from
--    refunds instead of erroring. This protects against double clicks,
--    network retries, and accidental double submissions.
-- =====================================================================

-- 4a) student_cancel_booking
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
  v_existing record;
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

  -- Idempotent path: already cancelled? Return the prior refund payload.
  IF v_b.status = 'cancelled' THEN
    SELECT id, refund_reason_category, student_cash_refund_cents, instructor_forfeit_cents
      INTO v_existing
      FROM public.refunds
     WHERE booking_id = _booking_id
       AND refund_reason_category IN ('student_cancel_timely','student_cancel_late')
     ORDER BY created_at DESC LIMIT 1;
    RETURN jsonb_build_object(
      'ok', true, 'idempotent', true,
      'refund_id', v_existing.id,
      'reason_category', COALESCE(v_existing.refund_reason_category, 'unknown'),
      'student_refund_cents', COALESCE(v_existing.student_cash_refund_cents, 0),
      'instructor_kept_cents', COALESCE(v_existing.instructor_forfeit_cents, 0),
      'rationale', 'Booking was already cancelled — returning prior refund.'
    );
  END IF;

  IF v_b.status <> 'reserved' THEN
    RAISE EXCEPTION 'Cannot cancel a % booking', v_b.status;
  END IF;

  SELECT * INTO v_split FROM public.compute_refund_split(_booking_id, 'student_cancel');
  v_refund_type := CASE WHEN v_split.reason_category = 'student_cancel_timely' THEN 'full' ELSE 'partial' END;

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
   WHERE id = _booking_id AND status = 'reserved';

  PERFORM public.audit_booking_action(
    'student_cancel_booking', _booking_id,
    jsonb_build_object('status', v_b.status),
    jsonb_build_object(
      'status', 'cancelled',
      'reason_category', v_split.reason_category,
      'student_refund_cents', COALESCE(v_split.student_cash_refund_cents, 0),
      'instructor_kept_cents', COALESCE(v_split.instructor_forfeit_cents, 0)
    ),
    _reason
  );

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
    'ok', true, 'idempotent', false,
    'refund_id', v_refund_id,
    'reason_category', v_split.reason_category,
    'student_refund_cents', COALESCE(v_split.student_cash_refund_cents, 0),
    'instructor_kept_cents', COALESCE(v_split.instructor_forfeit_cents, 0),
    'rationale', v_split.rationale
  );
END;
$$;

-- 4b) instructor_no_show_refund
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
  v_existing record;
  v_is_admin boolean;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_is_admin := public.has_role(v_caller, 'admin'::app_role);

  SELECT b.id, b.student_id, b.status, b.course_id, b.online_total_cents,
         b.platform_fee_cents, b.course_price_cents, c.instructor_id, c.title
    INTO v_b
    FROM public.bookings b JOIN public.courses c ON c.id = b.course_id
   WHERE b.id = _booking_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF v_b.student_id <> v_caller AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Only the affected student or an admin can report instructor no-show';
  END IF;

  -- Idempotent path: if cancelled and a prior instructor_no_show refund exists, return it.
  IF v_b.status = 'cancelled' THEN
    SELECT id, student_cash_refund_cents
      INTO v_existing
      FROM public.refunds
     WHERE booking_id = _booking_id
       AND refund_reason_category = 'instructor_no_show'
     ORDER BY created_at DESC LIMIT 1;
    IF v_existing.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true, 'idempotent', true,
        'refund_id', v_existing.id,
        'student_refund_cents', COALESCE(v_existing.student_cash_refund_cents, 0),
        'rationale', 'Instructor no-show was already reported — returning prior refund.'
      );
    END IF;
    RAISE EXCEPTION 'Booking is already cancelled';
  END IF;

  SELECT * INTO v_split FROM public.compute_refund_split(_booking_id, 'instructor_no_show');

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
   WHERE id = _booking_id AND status <> 'cancelled';

  PERFORM public.audit_booking_action(
    'instructor_no_show_refund', _booking_id,
    jsonb_build_object('status', v_b.status),
    jsonb_build_object(
      'status', 'cancelled',
      'student_refund_cents', v_split.student_cash_refund_cents
    ),
    _reason
  );

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (
    v_b.instructor_id::text, 'instructor_no_show_strike',
    'Strike: instructor no-show reported',
    'A no-show was reported for "' || v_b.title || '". The student was fully refunded ($25 + 100% course price) and a strike was added to your account.',
    '/instructor/dashboard'
  );

  RETURN jsonb_build_object(
    'ok', true, 'idempotent', false,
    'refund_id', v_refund_id,
    'student_refund_cents', v_split.student_cash_refund_cents,
    'rationale', v_split.rationale
  );
END;
$$;

-- 4c) student_no_show_refund
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
  v_existing record;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

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

  -- Idempotent path: if booking is already 'no_show', return the prior refund.
  IF v_b.status = 'no_show' THEN
    SELECT id, student_cash_refund_cents, instructor_forfeit_cents
      INTO v_existing
      FROM public.refunds
     WHERE booking_id = _booking_id
       AND refund_reason_category = 'student_cancel_late'
     ORDER BY created_at DESC LIMIT 1;
    RETURN jsonb_build_object(
      'ok', true, 'idempotent', true,
      'refund_id', v_existing.id,
      'student_refund_cents', COALESCE(v_existing.student_cash_refund_cents, 0),
      'instructor_kept_cents', COALESCE(v_existing.instructor_forfeit_cents, 0),
      'rationale', 'Student was already marked no-show — returning prior refund.'
    );
  END IF;

  IF v_b.status IN ('attended', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot mark no-show on a % booking', v_b.status;
  END IF;

  SELECT * INTO v_split FROM public.compute_refund_split(_booking_id, 'student_cancel_late');

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
   WHERE id = _booking_id AND status NOT IN ('attended','cancelled','no_show');

  PERFORM public.audit_booking_action(
    'student_no_show_refund', _booking_id,
    jsonb_build_object('status', v_b.status),
    jsonb_build_object(
      'status', 'no_show',
      'student_refund_cents', COALESCE(v_split.student_cash_refund_cents, 0),
      'instructor_kept_cents', COALESCE(v_split.instructor_forfeit_cents, 0)
    ),
    _reason
  );

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (
    v_b.student_id::text, 'no_show_refund',
    'You were marked as a no-show',
    'Your instructor reported you did not attend "' || v_b.title || '". A 90% refund of the course price ($' ||
      to_char(COALESCE(v_split.student_cash_refund_cents,0) / 100.0, 'FM999990.00') ||
      ') has been issued to your card. The instructor keeps 10% and TacLink retains the $25 platform fee.',
    '/student/booking/' || _booking_id
  );

  RETURN jsonb_build_object(
    'ok', true, 'idempotent', false,
    'refund_id', v_refund_id,
    'student_refund_cents', COALESCE(v_split.student_cash_refund_cents, 0),
    'instructor_kept_cents', COALESCE(v_split.instructor_forfeit_cents, 0),
    'rationale', v_split.rationale
  );
END;
$$;
