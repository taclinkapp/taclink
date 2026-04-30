-- 1. Per-booking cancellation cutoff snapshot
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancellation_cutoff_hours integer NOT NULL DEFAULT 48;

-- 2. Refund accounting columns
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS refund_reason_category text,
  ADD COLUMN IF NOT EXISTS instructor_forfeit_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_absorbed_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hours_before_course numeric;

-- Validate categories without a hard check constraint (so we can evolve)
CREATE OR REPLACE FUNCTION public.validate_refund_reason_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.refund_reason_category IS NOT NULL
     AND NEW.refund_reason_category NOT IN (
       'instructor_no_show','instructor_cancel','student_cancel_timely',
       'student_cancel_late','weather_reschedule','quality_complaint',
       'fraud_safety','chargeback_threat','other'
     ) THEN
    RAISE EXCEPTION 'Invalid refund_reason_category: %', NEW.refund_reason_category;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_refund_reason_category_trg ON public.refunds;
CREATE TRIGGER validate_refund_reason_category_trg
BEFORE INSERT OR UPDATE ON public.refunds
FOR EACH ROW EXECUTE FUNCTION public.validate_refund_reason_category();

-- 3. Single source of truth for refund splits
CREATE OR REPLACE FUNCTION public.compute_refund_split(
  _booking_id uuid,
  _reason text
)
RETURNS TABLE(
  student_credit_cents integer,
  instructor_forfeit_cents integer,
  platform_absorbed_cents integer,
  requires_owner boolean,
  hours_before_course numeric,
  reason_category text,
  rationale text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b record;
  v_hours numeric;
  v_cutoff int;
  v_platform int;
  v_deposit int;
  v_student int := 0;
  v_forfeit int := 0;
  v_absorb int := 0;
  v_owner boolean := false;
  v_rationale text := '';
BEGIN
  SELECT b.id, b.platform_fee_cents, b.deposit_amount_cents, b.online_total_cents,
         b.cancellation_cutoff_hours, c.starts_at
    INTO v_b
    FROM public.bookings b
    JOIN public.courses c ON c.id = b.course_id
   WHERE b.id = _booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found: %', _booking_id;
  END IF;

  v_platform := COALESCE(v_b.platform_fee_cents, 2500);
  v_deposit  := COALESCE(v_b.deposit_amount_cents, 0);
  v_cutoff   := COALESCE(v_b.cancellation_cutoff_hours, 48);

  IF v_b.starts_at IS NOT NULL THEN
    v_hours := EXTRACT(EPOCH FROM (v_b.starts_at - now())) / 3600.0;
  ELSE
    v_hours := NULL;
  END IF;

  -- Auto-detect timely vs late if a generic 'student_cancel' or NULL was passed
  IF _reason IN ('student_cancel','student_cancel_unspecified') OR _reason IS NULL THEN
    IF v_hours IS NOT NULL AND v_hours >= v_cutoff THEN
      _reason := 'student_cancel_timely';
    ELSE
      _reason := 'student_cancel_late';
    END IF;
  END IF;

  CASE _reason
    -- Instructor at fault: student fully made whole; instructor forfeits deposit.
    WHEN 'instructor_no_show', 'instructor_cancel' THEN
      v_student := v_platform + v_deposit;
      v_forfeit := v_deposit;
      v_absorb  := 0;
      v_owner   := false;
      v_rationale := 'Instructor at fault — student credited platform fee + deposit; instructor forfeits 10% deposit.';

    -- Fraud / safety: full credit + escalate to owner; instructor forfeits and gets strike.
    WHEN 'fraud_safety' THEN
      v_student := v_platform + v_deposit;
      v_forfeit := v_deposit;
      v_absorb  := 0;
      v_owner   := true;
      v_rationale := 'Fraud or safety incident — full credit issued, instructor forfeits deposit, owner review required.';

    -- Student cancels in time: gets the $25 platform fee back as credit; instructor keeps 10%.
    WHEN 'student_cancel_timely' THEN
      v_student := v_platform;
      v_forfeit := 0;
      v_absorb  := 0;
      v_owner   := false;
      v_rationale := format('Student cancelled %.1fh before (>= %sh cutoff) — $%.2f platform fee credited; instructor keeps 10%% deposit.',
                            v_hours, v_cutoff, v_platform/100.0);

    -- Student cancels late or no-shows: nothing refunded, instructor keeps deposit, TacLink keeps fee.
    WHEN 'student_cancel_late' THEN
      v_student := 0;
      v_forfeit := 0;
      v_absorb  := 0;
      v_owner   := false;
      v_rationale := format('Student cancelled %.1fh before (< %sh cutoff) — no credit; instructor keeps deposit.',
                            COALESCE(v_hours, 0), v_cutoff);

    -- Weather or mutual reschedule: no money moves; booking should be moved to a new date instead.
    WHEN 'weather_reschedule' THEN
      v_student := 0;
      v_forfeit := 0;
      v_absorb  := 0;
      v_owner   := false;
      v_rationale := 'Weather/mutual reschedule — no credit issued; reschedule the booking instead.';

    -- Quality complaint after attending: small goodwill platform-absorbed credit, owner-reviewed.
    WHEN 'quality_complaint' THEN
      v_student := v_platform; -- goodwill: refund the platform fee
      v_forfeit := 0;
      v_absorb  := v_platform; -- TacLink absorbs it
      v_owner   := true;
      v_rationale := 'Quality complaint — goodwill platform-fee credit absorbed by TacLink; owner review required.';

    -- Chargeback threat: never auto-decide, always owner.
    WHEN 'chargeback_threat' THEN
      v_student := 0;
      v_forfeit := 0;
      v_absorb  := 0;
      v_owner   := true;
      v_rationale := 'Chargeback / legal threat — escalated to owner; no automatic credit.';

    ELSE
      v_student := 0;
      v_forfeit := 0;
      v_absorb  := 0;
      v_owner   := true;
      v_rationale := 'Unknown reason — escalated to owner.';
  END CASE;

  RETURN QUERY SELECT v_student, v_forfeit, v_absorb, v_owner, v_hours, _reason, v_rationale;
END;
$$;

-- 4. When a refund tied to instructor fault is issued, forfeit the deposit
--    on the booking and award a strike to the instructor.
CREATE OR REPLACE FUNCTION public.apply_instructor_forfeit_on_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instructor uuid;
BEGIN
  IF NEW.status <> 'issued' THEN
    RETURN NEW;
  END IF;

  IF NEW.refund_reason_category NOT IN ('instructor_no_show','instructor_cancel','fraud_safety') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.instructor_forfeit_cents, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  -- Forfeit deposit on the booking (instructor will not be paid out)
  UPDATE public.bookings
     SET deposit_status = 'forfeited',
         updated_at = now()
   WHERE id = NEW.booking_id;

  -- Award strike to instructor
  SELECT c.instructor_id INTO v_instructor
    FROM public.courses c
    JOIN public.bookings b ON b.course_id = c.id
   WHERE b.id = NEW.booking_id;

  IF v_instructor IS NOT NULL THEN
    PERFORM public.award_strike(
      v_instructor,
      CASE WHEN NEW.refund_reason_category = 'fraud_safety' THEN 2 ELSE 1 END
    );

    -- Notify instructor
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_instructor::text,
      'deposit_forfeited',
      'Deposit forfeited',
      'A refund was issued for ' || NEW.refund_reason_category || '. Your $' ||
        (NEW.instructor_forfeit_cents / 100.0)::text || ' deposit on this booking has been forfeited.',
      '/instructor/dashboard'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_instructor_forfeit_on_refund_trg ON public.refunds;
CREATE TRIGGER apply_instructor_forfeit_on_refund_trg
AFTER INSERT OR UPDATE ON public.refunds
FOR EACH ROW EXECUTE FUNCTION public.apply_instructor_forfeit_on_refund();

-- 5. Reverse forfeit if a refund is later reversed (instructor dispute window)
CREATE OR REPLACE FUNCTION public.unforfeit_on_refund_reversal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'reversed' AND OLD.status <> 'reversed'
     AND COALESCE(OLD.instructor_forfeit_cents, 0) > 0 THEN
    UPDATE public.bookings
       SET deposit_status = 'pending_send',
           updated_at = now()
     WHERE id = NEW.booking_id
       AND deposit_status = 'forfeited';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS unforfeit_on_refund_reversal_trg ON public.refunds;
CREATE TRIGGER unforfeit_on_refund_reversal_trg
AFTER UPDATE ON public.refunds
FOR EACH ROW EXECUTE FUNCTION public.unforfeit_on_refund_reversal();