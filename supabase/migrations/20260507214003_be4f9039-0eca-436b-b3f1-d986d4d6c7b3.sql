
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_chosen_at timestamptz,
  ADD COLUMN IF NOT EXISTS credential_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS policy_acknowledged_at timestamptz;

-- Helper: instructor onboarding status
CREATE OR REPLACE FUNCTION public.instructor_onboarding_status(_user_id uuid)
RETURNS TABLE(complete boolean, next_step text, has_subscription boolean, has_credential boolean, has_policy_ack boolean, started_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub boolean;
  v_cred boolean;
  v_ack boolean;
  v_started timestamptz;
BEGIN
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
$$;

GRANT EXECUTE ON FUNCTION public.instructor_onboarding_status(uuid) TO authenticated;

-- Mark credential uploaded
CREATE OR REPLACE FUNCTION public.tg_mark_credential_uploaded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET credential_uploaded_at = COALESCE(credential_uploaded_at, now()),
         updated_at = now()
   WHERE id = NEW.instructor_id;
  PERFORM public.maybe_complete_instructor_onboarding(NEW.instructor_id);
  RETURN NEW;
END; $$;

-- Mark policy acknowledged
CREATE OR REPLACE FUNCTION public.tg_mark_policy_acknowledged()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET policy_acknowledged_at = COALESCE(policy_acknowledged_at, now()),
         updated_at = now()
   WHERE id = NEW.user_id;
  PERFORM public.maybe_complete_instructor_onboarding(NEW.user_id);
  RETURN NEW;
END; $$;

-- Mark subscription chosen on subscription insert
CREATE OR REPLACE FUNCTION public.tg_mark_subscription_chosen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET subscription_chosen_at = COALESCE(subscription_chosen_at, now()),
         updated_at = now()
   WHERE id = NEW.user_id;
  PERFORM public.maybe_complete_instructor_onboarding(NEW.user_id);
  RETURN NEW;
END; $$;

-- Helper to flip onboarding_completed_at when all 3 done
CREATE OR REPLACE FUNCTION public.maybe_complete_instructor_onboarding(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET onboarding_completed_at = now(),
         updated_at = now()
   WHERE id = _user_id
     AND onboarding_completed_at IS NULL
     AND subscription_chosen_at IS NOT NULL
     AND credential_uploaded_at IS NOT NULL
     AND policy_acknowledged_at IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'instructor'::app_role);
END; $$;

DROP TRIGGER IF EXISTS trg_mark_credential_uploaded ON public.instructor_credentials;
CREATE TRIGGER trg_mark_credential_uploaded
AFTER INSERT ON public.instructor_credentials
FOR EACH ROW EXECUTE FUNCTION public.tg_mark_credential_uploaded();

DROP TRIGGER IF EXISTS trg_mark_policy_acknowledged ON public.policy_acknowledgments;
CREATE TRIGGER trg_mark_policy_acknowledged
AFTER INSERT ON public.policy_acknowledgments
FOR EACH ROW EXECUTE FUNCTION public.tg_mark_policy_acknowledged();

DROP TRIGGER IF EXISTS trg_mark_subscription_chosen ON public.subscriptions;
CREATE TRIGGER trg_mark_subscription_chosen
AFTER INSERT ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.tg_mark_subscription_chosen();

-- RPC: instructor explicitly chooses Free plan
CREATE OR REPLACE FUNCTION public.instructor_choose_free_plan()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.profiles
     SET subscription_chosen_at = COALESCE(subscription_chosen_at, now()),
         onboarding_started_at = COALESCE(onboarding_started_at, now()),
         updated_at = now()
   WHERE id = auth.uid();
  PERFORM public.maybe_complete_instructor_onboarding(auth.uid());
END; $$;

GRANT EXECUTE ON FUNCTION public.instructor_choose_free_plan() TO authenticated;

-- Backfill existing instructors so we don't lock anyone out: treat any
-- pre-existing instructor with a profile older than 1 day as fully onboarded.
UPDATE public.profiles p
   SET onboarding_completed_at = COALESCE(onboarding_completed_at, p.created_at),
       subscription_chosen_at = COALESCE(subscription_chosen_at, p.created_at),
       credential_uploaded_at = COALESCE(credential_uploaded_at, p.created_at),
       policy_acknowledged_at = COALESCE(policy_acknowledged_at, p.created_at)
 WHERE p.created_at < now() - interval '1 day'
   AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'instructor'::app_role);

-- Cleanup function: returns user_ids of instructors who started onboarding
-- 24+ hours ago and haven't finished. Used by a scheduled edge function.
CREATE OR REPLACE FUNCTION public.list_stale_instructor_onboarders(_older_than_hours int DEFAULT 24)
RETURNS TABLE(user_id uuid, email text, started_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, u.email, COALESCE(p.onboarding_started_at, p.created_at)
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'instructor'::app_role
    JOIN auth.users u ON u.id = p.id
   WHERE p.onboarding_completed_at IS NULL
     AND COALESCE(p.onboarding_started_at, p.created_at) < now() - (_older_than_hours || ' hours')::interval
     AND NOT public.is_test_account(p.id)
     AND NOT public.has_role(p.id, 'admin'::app_role);
$$;
