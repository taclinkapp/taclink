-- 1) Onboarding gate bypass for test accounts
CREATE OR REPLACE FUNCTION public.instructor_onboarding_status(_user_id uuid)
RETURNS TABLE(complete boolean, next_step text, has_subscription boolean, has_credential boolean, has_policy_ack boolean, started_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sub boolean;
  v_cred boolean;
  v_ack boolean;
  v_started timestamptz;
BEGIN
  -- QA/test accounts skip every onboarding gate so end-to-end flows can be exercised.
  IF public.is_test_account(_user_id) THEN
    RETURN QUERY SELECT true, 'complete'::text, true, true, true, COALESCE(
      (SELECT onboarding_started_at FROM public.profiles WHERE id = _user_id),
      now()
    );
    RETURN;
  END IF;

  SELECT (subscription_chosen_at IS NOT NULL),
         (credential_uploaded_at IS NOT NULL),
         (policy_acknowledged_at IS NOT NULL),
         COALESCE(onboarding_started_at, created_at)
    INTO v_sub, v_cred, v_ack, v_started
    FROM public.profiles WHERE id = _user_id;

  IF v_sub IS NULL THEN
    RETURN QUERY SELECT false, 'subscription'::text, false, false, false, now();
    RETURN;
  END IF;

  RETURN QUERY SELECT
    (v_sub AND v_cred AND v_ack),
    CASE
      WHEN NOT v_sub THEN 'subscription'
      WHEN NOT v_cred THEN 'credential'
      WHEN NOT v_ack THEN 'policy'
      ELSE 'complete'
    END,
    v_sub, v_cred, v_ack, v_started;
END;
$function$;

-- 2) Skip 7-day lead-time DB trigger for test accounts
CREATE OR REPLACE FUNCTION public.enforce_course_min_lead_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_lead interval := interval '7 days';
BEGIN
  IF NEW.instructor_id IS NOT NULL AND public.is_test_account(NEW.instructor_id) THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'published' AND NEW.starts_at IS NOT NULL THEN
    IF TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE' AND (
             NEW.starts_at IS DISTINCT FROM OLD.starts_at
             OR (OLD.status IS DISTINCT FROM 'published' AND NEW.status = 'published')
           ))
    THEN
      IF NEW.starts_at < (now() + v_min_lead) THEN
        RAISE EXCEPTION 'Courses must start at least 7 days from now (got %).', NEW.starts_at
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Pending email allowlist so an email can be marked as a test account
-- BEFORE the user has signed up. When their profile is created the trigger
-- auto-inserts a matching test_accounts row.
CREATE TABLE IF NOT EXISTS public.pending_test_accounts (
  email text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('instructor','student','admin')),
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pending_test_accounts TO authenticated;
GRANT ALL ON public.pending_test_accounts TO service_role;

ALTER TABLE public.pending_test_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage pending test accounts"
ON public.pending_test_accounts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: when a profile is created, if its email is in pending_test_accounts,
-- promote it into test_accounts. Idempotent via NOT EXISTS guard.
CREATE OR REPLACE FUNCTION public.promote_pending_test_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_pending public.pending_test_accounts%ROWTYPE;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.id;
  IF v_email IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_pending FROM public.pending_test_accounts WHERE lower(email) = lower(v_email);
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.test_accounts WHERE user_id = NEW.id) THEN
    INSERT INTO public.test_accounts (user_id, email, role, label, created_by)
    VALUES (NEW.id, v_email, v_pending.role, COALESCE(v_pending.label, 'pending allowlist'), NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_pending_test_account ON public.profiles;
CREATE TRIGGER trg_promote_pending_test_account
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.promote_pending_test_account();