
-- 1. DROP credit system
DROP TRIGGER IF EXISTS trg_issue_credit_on_refund ON public.refunds;
DROP TRIGGER IF EXISTS trg_cancel_credit_on_refund_reversal ON public.refunds;
DROP TRIGGER IF EXISTS trg_award_punch_on_attendance ON public.bookings;
DROP TRIGGER IF EXISTS trg_award_referral_on_first_booking ON public.bookings;

DROP FUNCTION IF EXISTS public.issue_credit_on_refund() CASCADE;
DROP FUNCTION IF EXISTS public.cancel_credit_on_refund_reversal() CASCADE;
DROP FUNCTION IF EXISTS public.award_punch_on_attendance() CASCADE;
DROP FUNCTION IF EXISTS public.award_referral_on_first_booking() CASCADE;

DROP TABLE IF EXISTS public.student_credits CASCADE;
DROP TABLE IF EXISTS public.instructor_credits CASCADE;
DROP TABLE IF EXISTS public.instructor_punches CASCADE;

-- Drop old compute_refund_split (return shape changes)
DROP FUNCTION IF EXISTS public.compute_refund_split(uuid, text) CASCADE;

-- 2. Escrow columns on bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS escrow_status text NOT NULL DEFAULT 'pending'
    CHECK (escrow_status IN ('pending','held','released','refunded','forfeited','partially_refunded')),
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_charge_id text,
  ADD COLUMN IF NOT EXISTS escrow_held_at timestamptz,
  ADD COLUMN IF NOT EXISTS escrow_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS release_eligible_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS instructor_payout_cents integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_bookings_escrow_release_eligible
  ON public.bookings (escrow_status, release_eligible_at)
  WHERE escrow_status = 'held';

-- 3. Refund columns
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS stripe_refund_id text,
  ADD COLUMN IF NOT EXISTS refund_method text NOT NULL DEFAULT 'stripe_cash'
    CHECK (refund_method IN ('stripe_cash','manual','none')),
  ADD COLUMN IF NOT EXISTS student_cash_refund_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_refund_status text;

-- 4. New compute_refund_split (cash model)
CREATE FUNCTION public.compute_refund_split(_booking_id uuid, _reason text)
RETURNS TABLE(
  student_cash_refund_cents integer,
  instructor_forfeit_cents integer,
  platform_absorbed_cents integer,
  requires_owner boolean,
  hours_before_course numeric,
  reason_category text,
  rationale text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_b record;
  v_hours numeric;
  v_cutoff int := 48;
  v_platform int; v_deposit int;
  v_student int := 0; v_forfeit int := 0; v_absorb int := 0;
  v_owner boolean := false; v_rationale text := '';
BEGIN
  SELECT b.id, b.platform_fee_cents, b.deposit_amount_cents, b.online_total_cents,
         b.escrow_status, c.starts_at
    INTO v_b
    FROM public.bookings b JOIN public.courses c ON c.id = b.course_id
   WHERE b.id = _booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found: %', _booking_id; END IF;

  v_platform := COALESCE(v_b.platform_fee_cents, 2500);
  v_deposit  := COALESCE(v_b.deposit_amount_cents, 0);
  IF v_b.starts_at IS NOT NULL THEN
    v_hours := EXTRACT(EPOCH FROM (v_b.starts_at - now())) / 3600.0;
  END IF;

  IF _reason IN ('student_cancel','student_cancel_unspecified') OR _reason IS NULL THEN
    IF v_hours IS NOT NULL AND v_hours >= v_cutoff THEN
      _reason := 'student_cancel_timely';
    ELSE
      _reason := 'student_cancel_late';
    END IF;
  END IF;

  CASE _reason
    WHEN 'instructor_no_show', 'instructor_cancel' THEN
      v_student := v_platform + v_deposit; v_forfeit := v_deposit;
      v_rationale := 'Instructor at fault — full cash refund ($25 + 10%) to student within 48h. Instructor forfeits deposit.';
    WHEN 'fraud_safety' THEN
      v_student := v_platform + v_deposit; v_forfeit := v_deposit; v_owner := true;
      v_rationale := 'Fraud/safety incident — full cash refund + owner review + instructor strike.';
    WHEN 'student_cancel_timely', 'student_cancel_late' THEN
      v_rationale := 'Student cancellation — no refund. Student forfeits $25 + 10%. Instructor receives the 10% (released 24h after course).';
    WHEN 'weather_reschedule' THEN
      v_rationale := 'Weather/mutual reschedule — no refund; reschedule the booking instead.';
    WHEN 'quality_complaint' THEN
      v_owner := true;
      v_rationale := 'Quality complaint — owner review required. No automatic refund.';
    WHEN 'chargeback_threat' THEN
      v_owner := true;
      v_rationale := 'Chargeback/legal threat — escalated to owner.';
    ELSE
      v_owner := true;
      v_rationale := 'Unknown reason — escalated to owner.';
  END CASE;

  RETURN QUERY SELECT v_student, v_forfeit, v_absorb, v_owner, v_hours, _reason, v_rationale;
END;
$$;

-- 5. Releasable deposits helper
CREATE OR REPLACE FUNCTION public.list_releasable_deposits()
RETURNS TABLE(booking_id uuid, course_id uuid, instructor_id uuid,
              deposit_amount_cents integer, course_ended_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.course_id, c.instructor_id, b.deposit_amount_cents,
         COALESCE(c.ends_at, c.starts_at)
    FROM public.bookings b JOIN public.courses c ON c.id = b.course_id
   WHERE b.escrow_status = 'held'
     AND b.release_eligible_at IS NOT NULL
     AND b.release_eligible_at <= now()
     AND b.deposit_amount_cents > 0;
$$;

-- 6. Mark release eligible on attendance
CREATE OR REPLACE FUNCTION public.set_release_eligible_on_attendance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ends timestamptz;
BEGIN
  IF NEW.status <> 'attended' OR (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(c.ends_at, c.starts_at) INTO v_ends
    FROM public.courses c WHERE c.id = NEW.course_id;
  IF NEW.escrow_status = 'held' THEN
    NEW.release_eligible_at := COALESCE(v_ends, now()) + interval '24 hours';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_release_eligible_on_attendance ON public.bookings;
CREATE TRIGGER trg_set_release_eligible_on_attendance
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_release_eligible_on_attendance();

-- 7. Update forfeit trigger (no credit refs)
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
      'A refund was issued. Your $' || (NEW.instructor_forfeit_cents / 100.0)::text ||
      ' deposit has been refunded to the student.',
      '/instructor/dashboard');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_apply_instructor_forfeit_on_refund ON public.refunds;
CREATE TRIGGER trg_apply_instructor_forfeit_on_refund
  AFTER INSERT OR UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.apply_instructor_forfeit_on_refund();
