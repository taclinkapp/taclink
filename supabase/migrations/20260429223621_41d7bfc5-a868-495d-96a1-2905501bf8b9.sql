
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
  IF NEW.sender_role <> 'student' THEN
    RETURN NEW;
  END IF;

  v_lower := lower(coalesce(NEW.body, ''));

  IF v_lower !~ '(refund|money back|my money|chargeback|charge back|charge ?back|dispute|cancel.*(book|course|class|reservation)|cancel my|get my.*back|never showed|no[- ]show|didn.?t show|scam|ripped off|rip ?off|fraud|complaint|file a complaint|sue|lawyer|attorney|bbb|better business|reverse.*(charge|payment))' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_existing
    FROM public.ai_actions
   WHERE kind = 'dispute_triage'
     AND target_id = NEW.conversation_id::text
     AND status IN ('proposed','auto_paused','approved');
  IF v_existing > 0 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_conv FROM public.conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_conv.booking_id IS NOT NULL THEN
    SELECT b.id, b.status, b.course_id, b.online_total_cents, b.platform_fee_cents,
           b.deposit_amount_cents, b.deposit_status, b.in_person_paid_at,
           b.attended_at, b.created_at AS booked_on,
           c.title AS course_title, c.starts_at, c.ends_at, c.instructor_id
      INTO v_booking
      FROM public.bookings b
      JOIN public.courses c ON c.id = b.course_id
     WHERE b.id = v_conv.booking_id;
  ELSE
    BEGIN
      SELECT b.id, b.status, b.course_id, b.online_total_cents, b.platform_fee_cents,
             b.deposit_amount_cents, b.deposit_status, b.in_person_paid_at,
             b.attended_at, b.created_at AS booked_on,
             c.title AS course_title, c.starts_at, c.ends_at, c.instructor_id
        INTO v_booking
        FROM public.bookings b
        JOIN public.courses c ON c.id = b.course_id
       WHERE b.student_id::text = v_conv.student_id
         AND c.instructor_id::text = v_conv.instructor_id
       ORDER BY b.created_at DESC
       LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_booking := NULL;
    END;
  END IF;

  BEGIN
    SELECT count(*) INTO v_refund_count
      FROM public.refunds
     WHERE student_id::text = v_conv.student_id;
  EXCEPTION WHEN OTHERS THEN
    v_refund_count := 0;
  END;

  SELECT count(*) INTO v_prior_disputes
    FROM public.ai_actions
   WHERE kind = 'dispute_triage'
     AND target_id = NEW.conversation_id::text
     AND status IN ('executed','rejected');

  SELECT jsonb_agg(jsonb_build_object(
    'role', m.sender_role,
    'body', m.body,
    'at', m.created_at
  ) ORDER BY m.created_at)
    INTO v_recent_msgs
    FROM (
      SELECT * FROM public.messages
       WHERE conversation_id = NEW.conversation_id
       ORDER BY created_at DESC
       LIMIT 8
    ) m;

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
          'online_total_cents', v_booking.online_total_cents,
          'platform_fee_cents', v_booking.platform_fee_cents,
          'deposit_amount_cents', v_booking.deposit_amount_cents,
          'deposit_status', v_booking.deposit_status,
          'paid_in_person', (v_booking.in_person_paid_at IS NOT NULL)
        )
      ELSE NULL END,
      'student_history', jsonb_build_object(
        'prior_refunds', v_refund_count,
        'prior_disputes_in_thread', v_prior_disputes
      ),
      'policy', jsonb_build_object(
        'cash_refunds_offered', false,
        'all_refunds_as_in_app_credit', true,
        'platform_fee_refundable_cash', false,
        'deposit_refundable_cash', false,
        'instructor_no_show_exception', true,
        'note', 'TacLink does NOT issue cash refunds. All approved refunds (platform fee + deposit) are issued as in-app credit toward a future booking. Only the instructor-no-show / instructor-cancellation / fraud cases qualify for a full credit. For weather/personal/schedule conflicts, offer rescheduling first; in-app credit only as a fallback. Never promise money back to the student.'
      )
    )
  );

  v_url := COALESCE(NULLIF(current_setting('app.supabase_url', true),''),
                    'https://jocnlpkbaqmriedmbocl.supabase.co');
  PERFORM net.http_post(
    url := v_url || '/functions/v1/ai-propose',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := v_payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'queue_ai_dispute_triage failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;
