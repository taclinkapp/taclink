
-- 1. Add columns to refunds
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS auto_issued boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS risk_score integer,
  ADD COLUMN IF NOT EXISTS risk_factors jsonb,
  ADD COLUMN IF NOT EXISTS dispute_window_until timestamptz,
  ADD COLUMN IF NOT EXISTS instructor_disputed_at timestamptz,
  ADD COLUMN IF NOT EXISTS instructor_dispute_reason text,
  ADD COLUMN IF NOT EXISTS ai_action_id uuid;

CREATE INDEX IF NOT EXISTS idx_refunds_dispute_window
  ON public.refunds(dispute_window_until)
  WHERE dispute_window_until IS NOT NULL AND instructor_disputed_at IS NULL;

-- 2. Risk scoring function
CREATE OR REPLACE FUNCTION public.compute_student_risk_score(_student_id uuid)
RETURNS TABLE(score integer, factors jsonb)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prior_refunds int := 0;
  v_prior_disputes int := 0;
  v_account_age_days int := 0;
  v_total_bookings int := 0;
  v_attended int := 0;
  v_score int := 0;
  v_factors jsonb;
BEGIN
  SELECT COUNT(*) INTO v_prior_refunds
    FROM public.refunds
   WHERE student_id = _student_id AND status = 'issued';

  SELECT COUNT(*) INTO v_prior_disputes
    FROM public.ai_actions a
    JOIN public.conversations c ON c.id::text = a.target_id
   WHERE a.kind = 'dispute_triage'
     AND c.student_id = _student_id::text;

  SELECT EXTRACT(EPOCH FROM (now() - created_at))::int / 86400
    INTO v_account_age_days
    FROM public.profiles WHERE id = _student_id;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE attended_at IS NOT NULL)
    INTO v_total_bookings, v_attended
    FROM public.bookings WHERE student_id = _student_id;

  -- Scoring: higher = riskier
  v_score := 0;
  IF v_prior_refunds >= 3 THEN v_score := v_score + 50;
  ELSIF v_prior_refunds = 2 THEN v_score := v_score + 30;
  ELSIF v_prior_refunds = 1 THEN v_score := v_score + 15;
  END IF;

  IF v_prior_disputes >= 3 THEN v_score := v_score + 25;
  ELSIF v_prior_disputes = 2 THEN v_score := v_score + 15;
  END IF;

  IF v_account_age_days < 7 THEN v_score := v_score + 20;
  ELSIF v_account_age_days < 30 THEN v_score := v_score + 10;
  END IF;

  IF v_total_bookings = 0 THEN v_score := v_score + 10;
  ELSIF v_total_bookings >= 3 AND v_attended * 2 >= v_total_bookings THEN
    v_score := GREATEST(0, v_score - 15); -- good-faith discount
  END IF;

  v_score := LEAST(100, GREATEST(0, v_score));

  v_factors := jsonb_build_object(
    'prior_refunds', v_prior_refunds,
    'prior_disputes', v_prior_disputes,
    'account_age_days', v_account_age_days,
    'total_bookings', v_total_bookings,
    'attended', v_attended
  );

  RETURN QUERY SELECT v_score, v_factors;
END;
$$;

-- 3. Function instructors call to dispute an auto-issued credit (within window)
CREATE OR REPLACE FUNCTION public.instructor_dispute_refund(
  _refund_id uuid,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refund public.refunds%ROWTYPE;
  v_is_instructor boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = _refund_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund not found';
  END IF;

  -- Verify caller is the instructor for this booking
  SELECT EXISTS(
    SELECT 1 FROM public.bookings b
      JOIN public.courses c ON c.id = b.course_id
     WHERE b.id = v_refund.booking_id AND c.instructor_id = auth.uid()
  ) INTO v_is_instructor;

  IF NOT v_is_instructor AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only the course instructor can dispute this credit';
  END IF;

  IF v_refund.status <> 'issued' THEN
    RAISE EXCEPTION 'Only issued credits can be disputed (current: %)', v_refund.status;
  END IF;

  IF v_refund.dispute_window_until IS NULL OR now() > v_refund.dispute_window_until THEN
    RAISE EXCEPTION 'Dispute window has closed';
  END IF;

  -- Reverse the refund (existing trigger cancel_credit_on_refund_reversal will void unredeemed credit)
  UPDATE public.refunds
     SET status = 'reversed',
         instructor_disputed_at = now(),
         instructor_dispute_reason = _reason,
         updated_at = now()
   WHERE id = _refund_id;

  -- Notify student
  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  SELECT v_refund.student_id::text,
         'refund_disputed',
         'Your auto-credit is under review',
         'The instructor has disputed the auto-issued credit. Our team will review and contact you within 24 hours.',
         '/student/booking/' || v_refund.booking_id
  ;

  -- Notify owner via ai_actions (escalation)
  INSERT INTO public.ai_actions (
    kind, status, risk_level, confidence, target_type, target_id,
    payload, preview, reasoning, auto_approved
  ) VALUES (
    'dispute_triage', 'proposed', 'high', 0.99, 'refund', _refund_id::text,
    jsonb_build_object(
      'classification', 'instructor_disputed_auto_credit',
      'recommended_action', 'escalate_to_owner',
      'reply_text', 'The instructor disputed an auto-issued credit. Owner review required.',
      'internal_note', _reason,
      'refund_id', _refund_id
    ),
    'Instructor disputed an auto-issued credit — owner review required',
    'Instructor pushed back within 24h dispute window',
    false
  );

  RETURN jsonb_build_object('ok', true, 'reversed', true);
END;
$$;

-- 4. Add auto_refund rule to settings
UPDATE public.ai_auto_approve_settings
   SET rules = rules || jsonb_build_object(
         'auto_refund', jsonb_build_object(
           'enabled', false,
           'max_risk', 'low',
           'min_confidence', 0.95,
           'max_amount_cents', 5000,
           'max_risk_score', 30,
           'dispute_window_hours', 24
         )
       )
 WHERE id = 1;
