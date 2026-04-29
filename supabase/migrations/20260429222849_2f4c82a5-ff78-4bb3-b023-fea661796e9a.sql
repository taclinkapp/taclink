
-- 1. Extend student_credits to carry a cash value + link back to the refund
ALTER TABLE public.student_credits
  ADD COLUMN IF NOT EXISTS amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_id uuid;

-- 2. Allow the new credit_type and refund sources
-- (no enum — credit_type is text, so nothing to alter)

-- 3. Loosen refunds.refund_type check to match what the UI offers
ALTER TABLE public.refunds DROP CONSTRAINT IF EXISTS refunds_refund_type_check;
ALTER TABLE public.refunds ADD CONSTRAINT refunds_refund_type_check
  CHECK (refund_type = ANY (ARRAY['platform_fee','deposit','full','partial','goodwill','other']));

-- 4. Trigger: every issued refund auto-creates a matching credit
CREATE OR REPLACE FUNCTION public.issue_credit_on_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
BEGIN
  -- Only act on freshly issued refunds
  IF NEW.status <> 'issued' THEN
    RETURN NEW;
  END IF;

  -- Idempotent: skip if a credit already exists for this refund
  SELECT id INTO v_existing FROM public.student_credits WHERE refund_id = NEW.id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.student_credits (
    student_id, credit_type, source, amount_cents, refund_id, note
  ) VALUES (
    NEW.student_id,
    'refund_credit',
    'refund',
    NEW.amount_cents,
    NEW.id,
    'Refund issued as in-app credit: ' || COALESCE(NEW.reason, '')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_issue_credit_on_refund ON public.refunds;
CREATE TRIGGER trg_issue_credit_on_refund
AFTER INSERT ON public.refunds
FOR EACH ROW EXECUTE FUNCTION public.issue_credit_on_refund();

-- 5. Trigger: reversing a refund clears the credit (only if not redeemed)
CREATE OR REPLACE FUNCTION public.cancel_credit_on_refund_reversal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'reversed' AND OLD.status <> 'reversed' THEN
    DELETE FROM public.student_credits
     WHERE refund_id = NEW.id
       AND redeemed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_credit_on_refund_reversal ON public.refunds;
CREATE TRIGGER trg_cancel_credit_on_refund_reversal
AFTER UPDATE ON public.refunds
FOR EACH ROW EXECUTE FUNCTION public.cancel_credit_on_refund_reversal();
