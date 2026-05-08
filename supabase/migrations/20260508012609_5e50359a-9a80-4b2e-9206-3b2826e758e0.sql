
-- 1. New columns
ALTER TABLE public.instructor_credentials
  ADD COLUMN IF NOT EXISTS ai_name_match_score numeric,
  ADD COLUMN IF NOT EXISTS ai_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

-- 2. Decision audit log
CREATE TABLE IF NOT EXISTS public.credential_decision_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES public.instructor_credentials(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL,
  old_status text,
  new_status text NOT NULL,
  decided_by uuid,
  decided_by_kind text NOT NULL DEFAULT 'ai', -- 'ai' | 'admin' | 'system'
  reason text,
  ai_confidence numeric,
  ai_name_match_score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credential_decision_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors view own credential decisions"
  ON public.credential_decision_log FOR SELECT TO authenticated
  USING (auth.uid() = instructor_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins insert credential decisions"
  ON public.credential_decision_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_credential_decision_log_credential
  ON public.credential_decision_log(credential_id, created_at DESC);

-- Trigger that records every status change automatically
CREATE OR REPLACE FUNCTION public.tg_log_credential_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.credential_decision_log (
      credential_id, instructor_id, old_status, new_status,
      decided_by, decided_by_kind, reason, ai_confidence, ai_name_match_score
    ) VALUES (
      NEW.id,
      NEW.instructor_id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
      NEW.status,
      auth.uid(),
      CASE
        WHEN auth.uid() IS NULL THEN 'system'
        WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN 'admin'
        ELSE 'ai'
      END,
      NEW.ai_reasons,
      NEW.ai_confidence,
      NEW.ai_name_match_score
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_credential_decision ON public.instructor_credentials;
CREATE TRIGGER trg_log_credential_decision
AFTER INSERT OR UPDATE ON public.instructor_credentials
FOR EACH ROW EXECUTE FUNCTION public.tg_log_credential_decision();

-- 3. Approved-credential helper
CREATE OR REPLACE FUNCTION public.instructor_has_approved_credential(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.instructor_credentials
     WHERE instructor_id = _user_id
       AND status = 'approved'
       AND (ai_expires_on IS NULL OR ai_expires_on >= CURRENT_DATE)
  );
$$;

-- 4. Replace publish gate to also require approved credential
CREATE OR REPLACE FUNCTION public.enforce_instructor_connect_for_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider text;
  v_status text;
  v_method_count int;
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    -- QA test instructors exempt
    IF public.is_test_account(NEW.instructor_id) THEN
      RETURN NEW;
    END IF;

    -- Require AI-approved credential
    IF NOT public.instructor_has_approved_credential(NEW.instructor_id) THEN
      RAISE EXCEPTION 'Your credential must be approved before you can publish a course. AI review usually completes within 1 hour of upload.'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT active_provider INTO v_provider FROM public.payment_provider_settings WHERE id = TRUE;

    IF v_provider = 'helcim' THEN
      SELECT count(*) INTO v_method_count FROM public.instructor_payout_methods WHERE instructor_id = NEW.instructor_id;
      IF v_method_count = 0 THEN
        RAISE EXCEPTION 'You must add a payout method before publishing a course. Go to Settings → Payout Methods to add one.'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      SELECT stripe_connect_status INTO v_status FROM public.profiles WHERE id = NEW.instructor_id;
      IF v_status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'You must complete payout setup before publishing a course. Go to Settings → Payout Methods to finish onboarding.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Resubmit rate limit (max 3 uploads per 24h per instructor)
CREATE OR REPLACE FUNCTION public.enforce_credential_resubmit_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF public.is_test_account(NEW.instructor_id)
     OR public.has_role(NEW.instructor_id, 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
    FROM public.instructor_credentials
   WHERE instructor_id = NEW.instructor_id
     AND created_at > now() - interval '24 hours';

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'You can only upload 3 credential attempts per 24 hours. Please wait before retrying or contact support.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credential_resubmit_limit ON public.instructor_credentials;
CREATE TRIGGER trg_credential_resubmit_limit
BEFORE INSERT ON public.instructor_credentials
FOR EACH ROW EXECUTE FUNCTION public.enforce_credential_resubmit_limit();

-- 6. Daily expiration sweep
CREATE OR REPLACE FUNCTION public.expire_stale_credentials()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH updated AS (
    UPDATE public.instructor_credentials
       SET status = 'expired',
           expired_at = now(),
           updated_at = now()
     WHERE status = 'approved'
       AND ai_expires_on IS NOT NULL
       AND ai_expires_on < CURRENT_DATE
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

-- Schedule daily at 09:00 UTC
DO $$
BEGIN
  PERFORM cron.unschedule('expire-stale-credentials');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'expire-stale-credentials',
  '0 9 * * *',
  $$ SELECT public.expire_stale_credentials(); $$
);
