
-- =====================================================================
-- 1. Migrate existing bookings to the new full-online model
-- =====================================================================
-- For every booking that has NOT yet had an in-person payment recorded,
-- shift the deposit to be the full course price and zero out the
-- in-person balance. Recompute the online total.
UPDATE public.bookings
   SET instructor_deposit_cents = course_price_cents,
       due_in_person_cents = 0,
       online_total_cents = COALESCE(platform_fee_cents, 2500) + course_price_cents,
       deposit_amount_cents = course_price_cents,
       updated_at = now()
 WHERE in_person_paid_at IS NULL
   AND course_price_cents IS NOT NULL
   AND course_price_cents > 0;

-- =====================================================================
-- 2. Rewrite compute_refund_split for full-online + 90/10 late-cancel
-- =====================================================================
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
  v_platform int;
  v_course_price int;
  v_ten_pct int;
  v_ninety_pct int;
  v_student int := 0;
  v_forfeit int := 0;
  v_absorb int := 0;
  v_owner boolean := false;
  v_rationale text := '';
BEGIN
  SELECT b.id, b.platform_fee_cents, b.deposit_amount_cents, b.online_total_cents,
         b.course_price_cents, b.escrow_status, b.booked_at,
         b.cancellation_cutoff_hours, c.starts_at
    INTO v_b
    FROM public.bookings b JOIN public.courses c ON c.id = b.course_id
   WHERE b.id = _booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found: %', _booking_id; END IF;

  v_platform     := COALESCE(v_b.platform_fee_cents, 2500);
  v_course_price := COALESCE(v_b.course_price_cents, 0);
  v_ten_pct      := ROUND(v_course_price * 0.10);
  v_ninety_pct   := v_course_price - v_ten_pct;
  v_cutoff       := COALESCE(v_b.cancellation_cutoff_hours,
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
      -- Student gets 100% back ($25 + full course price). Instructor gets nothing.
      v_student := v_platform + v_course_price;
      v_forfeit := v_course_price;
      v_rationale := 'Instructor at fault — full cash refund ($25 + course price) to student. Instructor receives nothing for this booking.';
    WHEN 'fraud_safety' THEN
      v_student := v_platform + v_course_price;
      v_forfeit := v_course_price;
      v_owner := true;
      v_rationale := 'Fraud/safety incident — full cash refund + owner review + instructor strike.';
    WHEN 'student_cancel_timely' THEN
      -- Within grace window: student gets 100% back ($25 + full course price).
      v_student := v_platform + v_course_price;
      v_rationale := format(
        'Student cancelled within their %sh grace window — full cash refund ($25 + 100%% course price). Instructor receives no payout.',
        v_cutoff
      );
    WHEN 'student_cancel_late' THEN
      -- Outside grace window: student gets 90% of course price back.
      -- Instructor receives the 10% forfeit. TacLink keeps the $25 platform fee.
      v_student := v_ninety_pct;
      v_forfeit := v_ten_pct;
      v_rationale := format(
        'Student cancelled after the %sh grace window — student receives 90%% of course price back. Instructor keeps 10%% as compensation. TacLink retains the $25 platform fee.',
        v_cutoff
      );
    WHEN 'weather_reschedule' THEN
      v_rationale := 'Weather/mutual reschedule — no refund; reschedule the booking instead.';
    WHEN 'quality_complaint' THEN
      v_student := v_platform;
      v_absorb := v_platform;
      v_owner := true;
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

-- =====================================================================
-- 3. Update instructor_cancel_course to refund full new online total
-- =====================================================================
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
    v_timely := true;
  ELSE
    v_hours := EXTRACT(EPOCH FROM (v_course.starts_at - now())) / 3600.0;
    v_timely := v_hours >= 48;
  END IF;

  v_reason_cat := CASE WHEN v_timely THEN 'instructor_cancel_timely' ELSE 'instructor_cancel' END;

  FOR v_booking IN
    SELECT id, student_id, platform_fee_cents, deposit_amount_cents,
           course_price_cents, escrow_status, online_total_cents
      FROM public.bookings
     WHERE course_id = _course_id
       AND status NOT IN ('cancelled')
  LOOP
    -- Full refund = whatever student paid online (platform fee + course price)
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

-- =====================================================================
-- 4. Hard-block course publishing without active Stripe Connect
-- =====================================================================
CREATE OR REPLACE FUNCTION public.enforce_instructor_connect_for_publish()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    SELECT stripe_connect_status INTO v_status
      FROM public.profiles
     WHERE id = NEW.instructor_id;

    IF v_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'You must complete Stripe payout setup before publishing a course. Go to Settings → Payout Methods to finish onboarding.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS courses_enforce_connect_for_publish ON public.courses;
CREATE TRIGGER courses_enforce_connect_for_publish
  BEFORE INSERT OR UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_instructor_connect_for_publish();

-- =====================================================================
-- 5. Update AI dispute triage prompt to reflect new policy
-- =====================================================================
CREATE OR REPLACE FUNCTION public.queue_ai_dispute_triage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conv public.conversations%ROWTYPE;
  v_existing int;
  v_url text;
  v_payload jsonb;
  v_booking record;
  v_refund_count int := 0;
  v_prior_disputes int := 0;
  v_recent_msgs jsonb;
  v_lower text;
BEGIN
  IF NEW.sender_role <> 'student' THEN RETURN NEW; END IF;
  v_lower := lower(coalesce(NEW.body, ''));
  IF v_lower !~ '(refund|money back|my money|chargeback|charge back|charge ?back|dispute|cancel.*(book|course|class|reservation)|cancel my|get my.*back|never showed|no[- ]show|didn.?t show|scam|ripped off|rip ?off|fraud|complaint|file a complaint|sue|lawyer|attorney|bbb|better business|reverse.*(charge|payment))' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_existing FROM public.ai_actions
   WHERE kind = 'dispute_triage' AND target_id = NEW.conversation_id::text
     AND status IN ('proposed','auto_paused','approved');
  IF v_existing > 0 THEN RETURN NEW; END IF;

  SELECT * INTO v_conv FROM public.conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_conv.booking_id IS NOT NULL THEN
    SELECT b.id, b.status, b.course_id, b.online_total_cents, b.platform_fee_cents,
           b.course_price_cents, b.deposit_amount_cents, b.deposit_status,
           b.attended_at, b.created_at AS booked_on, b.cancellation_cutoff_hours,
           c.title AS course_title, c.starts_at, c.ends_at, c.instructor_id
      INTO v_booking
      FROM public.bookings b JOIN public.courses c ON c.id = b.course_id
     WHERE b.id = v_conv.booking_id;
  END IF;

  BEGIN
    SELECT count(*) INTO v_refund_count FROM public.refunds WHERE student_id::text = v_conv.student_id;
  EXCEPTION WHEN OTHERS THEN v_refund_count := 0; END;

  SELECT count(*) INTO v_prior_disputes FROM public.ai_actions
   WHERE kind = 'dispute_triage' AND target_id = NEW.conversation_id::text
     AND status IN ('executed','rejected');

  SELECT jsonb_agg(jsonb_build_object('role', m.sender_role, 'body', m.body, 'at', m.created_at) ORDER BY m.created_at)
    INTO v_recent_msgs
    FROM (SELECT * FROM public.messages WHERE conversation_id = NEW.conversation_id ORDER BY created_at DESC LIMIT 8) m;

  v_payload := jsonb_build_object(
    'kind', 'dispute_triage',
    'target_type', 'conversation',
    'target_id', NEW.conversation_id::text,
    'context', jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'course_title', v_conv.course_title,
      'student_name', v_conv.student_name,
      'student_id', v_conv.student_id,
      'instructor_name', v_conv.instructor_name,
      'instructor_id', v_conv.instructor_id,
      'latest_message', NEW.body,
      'recent_messages', v_recent_msgs,
      'booking', CASE WHEN v_booking.id IS NOT NULL THEN
        jsonb_build_object(
          'booking_id', v_booking.id,
          'booking_status', v_booking.status,
          'course_title', v_booking.course_title,
          'course_starts_at', v_booking.starts_at,
          'course_ends_at', v_booking.ends_at,
          'course_already_happened', (v_booking.starts_at IS NOT NULL AND v_booking.starts_at < now()),
          'attended', (v_booking.attended_at IS NOT NULL),
          'booked_on', v_booking.booked_on,
          'cancellation_cutoff_hours', v_booking.cancellation_cutoff_hours,
          'online_total_cents', v_booking.online_total_cents,
          'platform_fee_cents', v_booking.platform_fee_cents,
          'course_price_cents', v_booking.course_price_cents,
          'deposit_status', v_booking.deposit_status
        )
      ELSE NULL END,
      'student_history', jsonb_build_object(
        'prior_refunds', v_refund_count,
        'prior_disputes_in_thread', v_prior_disputes
      ),
      'policy', jsonb_build_object(
        'model', 'full_online_payment',
        'cash_refunds_offered', true,
        'in_app_credit_system', false,
        'pay_in_person', false,
        'refund_method', 'stripe_cash_to_original_payment_method',
        'refund_eta_hours', 48,
        'tiered_grace_window', true,
        'note', 'TacLink charges the student the FULL course price + $25 platform fee online at booking. Nothing is paid in person. Refund rules: (1) Within the booking grace window (72/48/24/0h tiered, see booking.cancellation_cutoff_hours) = FULL cash refund of $25 + entire course price. (2) After grace window (late student cancel) = student receives 90% of course price back; instructor keeps 10% as compensation; TacLink keeps the $25 platform fee. (3) Instructor no-show or cancel = student gets 100% back regardless of timing. (4) Fraud/safety = 100% refund + owner review. All refunds go to the original payment method via Stripe within 48 hours. Never promise in-app credit — that system does not exist.'
      )
    )
  );

  v_url := COALESCE(NULLIF(current_setting('app.supabase_url', true),''),
                    'https://jocnlpkbaqmriedmbocl.supabase.co');
  PERFORM net.http_post(url := v_url || '/functions/v1/ai-propose',
    headers := '{"Content-Type":"application/json"}'::jsonb, body := v_payload);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'queue_ai_dispute_triage failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;
