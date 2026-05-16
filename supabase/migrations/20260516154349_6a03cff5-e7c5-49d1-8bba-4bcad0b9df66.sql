
-- =========================================================================
-- Founding Instructors program
-- =========================================================================

-- 1) Enum for founder status
DO $$ BEGIN
  CREATE TYPE public.founder_status AS ENUM ('pending_prelaunch','active','expired','revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Table
CREATE TABLE IF NOT EXISTS public.founding_instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  founder_rank int NOT NULL UNIQUE CHECK (founder_rank BETWEEN 1 AND 1000),
  qualified_at timestamptz NOT NULL DEFAULT now(),
  launch_date_used timestamptz,
  free_pro_starts_at timestamptz,
  free_pro_ends_at timestamptz,
  founder_status public.founder_status NOT NULL DEFAULT 'pending_prelaunch',
  granted_by uuid,
  revoked_at timestamptz,
  revoked_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_founding_instructors_status ON public.founding_instructors(founder_status);
CREATE INDEX IF NOT EXISTS idx_founding_instructors_user ON public.founding_instructors(user_id);

GRANT SELECT ON public.founding_instructors TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.founding_instructors TO service_role;

ALTER TABLE public.founding_instructors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "founders self read" ON public.founding_instructors;
CREATE POLICY "founders self read" ON public.founding_instructors
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Anonymous + authenticated may not read individual rows except their own (above).
-- Aggregate count is exposed via a SECURITY DEFINER function below.

DROP POLICY IF EXISTS "founders admin write" ON public.founding_instructors;
CREATE POLICY "founders admin write" ON public.founding_instructors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- updated_at touch
DROP TRIGGER IF EXISTS trg_touch_founding_instructors ON public.founding_instructors;
CREATE TRIGGER trg_touch_founding_instructors
  BEFORE UPDATE ON public.founding_instructors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Public stats RPC (no PII)
CREATE OR REPLACE FUNCTION public.get_founder_program_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total int;
  v_pending int;
  v_active int;
  v_expired int;
  v_revoked int;
  v_cap int := 1000;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE founder_status = 'pending_prelaunch'),
    COUNT(*) FILTER (WHERE founder_status = 'active'),
    COUNT(*) FILTER (WHERE founder_status = 'expired'),
    COUNT(*) FILTER (WHERE founder_status = 'revoked')
  INTO v_total, v_pending, v_active, v_expired, v_revoked
  FROM public.founding_instructors;

  RETURN jsonb_build_object(
    'cap', v_cap,
    'claimed', v_total,
    'remaining', GREATEST(0, v_cap - v_total),
    'pending_prelaunch', v_pending,
    'active', v_active,
    'expired', v_expired,
    'revoked', v_revoked
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_founder_program_stats() TO anon, authenticated, service_role;

-- 4) Qualification routine (race-safe via advisory lock)
-- Returns the founder row (json) if granted/already-exists, NULL if cap reached or ineligible.
CREATE OR REPLACE FUNCTION public.qualify_founding_instructor(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing public.founding_instructors%ROWTYPE;
  v_is_instructor boolean;
  v_is_test boolean;
  v_next_rank int;
  v_state jsonb;
  v_mode text;
  v_activated_at timestamptz;
  v_new public.founding_instructors%ROWTYPE;
  v_status public.founder_status;
  v_starts timestamptz;
  v_ends timestamptz;
  v_launch_used timestamptz;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;

  -- Must be an instructor and not a QA/test account
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'instructor'::public.app_role)
    INTO v_is_instructor;
  IF NOT v_is_instructor THEN RETURN NULL; END IF;

  SELECT public.is_test_account(_user_id) INTO v_is_test;
  IF v_is_test THEN RETURN NULL; END IF;

  -- Already a founder? Return existing row.
  SELECT * INTO v_existing FROM public.founding_instructors WHERE user_id = _user_id;
  IF FOUND THEN
    RETURN to_jsonb(v_existing);
  END IF;

  -- Serialize rank assignment across concurrent transactions.
  PERFORM pg_advisory_xact_lock(hashtext('founding_instructors_rank'));

  -- Re-check after lock
  SELECT * INTO v_existing FROM public.founding_instructors WHERE user_id = _user_id;
  IF FOUND THEN
    RETURN to_jsonb(v_existing);
  END IF;

  SELECT COALESCE(MAX(founder_rank), 0) + 1 INTO v_next_rank FROM public.founding_instructors;
  IF v_next_rank > 1000 THEN
    RETURN NULL; -- cap reached
  END IF;

  -- Determine status + Pro window based on current launch state.
  v_state := public.get_effective_launch_state();
  v_mode := v_state->>'mode';
  v_activated_at := (v_state->>'activated_at')::timestamptz;

  IF v_mode = 'live' AND v_activated_at IS NOT NULL THEN
    -- Post-launch qualifier: immediate active, clock starts now.
    v_status := 'active';
    v_starts := now();
    v_ends := now() + interval '6 months';
    v_launch_used := v_activated_at;
  ELSE
    -- Pre-launch (or paused): wait for activation routine to fill in dates.
    v_status := 'pending_prelaunch';
    v_starts := NULL;
    v_ends := NULL;
    v_launch_used := NULL;
  END IF;

  INSERT INTO public.founding_instructors (
    user_id, founder_rank, qualified_at, launch_date_used,
    free_pro_starts_at, free_pro_ends_at, founder_status
  ) VALUES (
    _user_id, v_next_rank, now(), v_launch_used,
    v_starts, v_ends, v_status
  )
  RETURNING * INTO v_new;

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (
    _user_id::text, 'founder_granted',
    'You''re a Founding Instructor!',
    CASE WHEN v_status = 'active'
      THEN 'Welcome — your Pro plan is free for the next 6 months.'
      ELSE 'You''re in the first 1,000! Pro will be free for 6 months starting on launch day.'
    END,
    '/instructor/subscription'
  );

  RETURN to_jsonb(v_new);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'qualify_founding_instructor failed for %: %', _user_id, SQLERRM;
  RETURN NULL;
END $$;

GRANT EXECUTE ON FUNCTION public.qualify_founding_instructor(uuid) TO authenticated, service_role;

-- 5) Trigger on profile onboarding completion → auto-qualify
CREATE OR REPLACE FUNCTION public.tg_qualify_founder_on_onboarding_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.onboarding_completed_at IS NOT NULL
     AND (OLD.onboarding_completed_at IS NULL OR OLD.onboarding_completed_at IS DISTINCT FROM NEW.onboarding_completed_at) THEN
    PERFORM public.qualify_founding_instructor(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_founder_on_onboarding_complete ON public.profiles;
CREATE TRIGGER trg_founder_on_onboarding_complete
  AFTER UPDATE OF onboarding_completed_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_qualify_founder_on_onboarding_complete();

-- 6) Activate pending founders at launch (called from activate_launch_if_due)
CREATE OR REPLACE FUNCTION public.activate_pending_founders(_launch_at timestamptz)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count int;
BEGIN
  WITH updated AS (
    UPDATE public.founding_instructors
       SET founder_status = 'active',
           free_pro_starts_at = _launch_at,
           free_pro_ends_at = _launch_at + interval '6 months',
           launch_date_used = _launch_at,
           updated_at = now()
     WHERE founder_status = 'pending_prelaunch'
    RETURNING id, user_id
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  -- Best-effort notify activated founders
  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  SELECT user_id::text, 'founder_pro_active',
         'Your Founding Instructor Pro is live',
         'Enjoy 6 months of Pro on us. Renews/upgrades available anytime in Settings.',
         '/instructor/subscription'
    FROM public.founding_instructors
   WHERE founder_status = 'active' AND free_pro_starts_at = _launch_at;

  RETURN COALESCE(v_count, 0);
END $$;

GRANT EXECUTE ON FUNCTION public.activate_pending_founders(timestamptz) TO service_role;

-- 7) Expiration routine — flip active founders to expired once window has passed.
CREATE OR REPLACE FUNCTION public.expire_founders_due()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  WITH updated AS (
    UPDATE public.founding_instructors
       SET founder_status = 'expired', updated_at = now()
     WHERE founder_status = 'active'
       AND free_pro_ends_at IS NOT NULL
       AND free_pro_ends_at <= now()
    RETURNING id, user_id
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN COALESCE(v_count, 0);
END $$;

GRANT EXECUTE ON FUNCTION public.expire_founders_due() TO service_role;

-- 8) Extend activate_launch_if_due to also activate founders + expire any due.
CREATE OR REPLACE FUNCTION public.activate_launch_if_due()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.launch_config%ROWTYPE;
  v_activated boolean := false;
  v_founders_activated int := 0;
  v_founders_expired int := 0;
  v_launch_at timestamptz;
BEGIN
  SELECT * INTO c FROM public.launch_config WHERE id = TRUE FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_config');
  END IF;

  IF c.launch_mode = 'prelaunch'
     AND NOT c.manual_override
     AND c.launch_at IS NOT NULL
     AND c.launch_at <= now()
     AND c.activated_at IS NULL
  THEN
    UPDATE public.launch_config
       SET launch_mode = 'live',
           activated_at = now(),
           bookings_enabled = true,
           publish_enabled = true,
           pro_unlock_enabled = true,
           waitlist_enabled = false,
           last_updated_at = now()
     WHERE id = TRUE AND activated_at IS NULL
     RETURNING activated_at INTO v_launch_at;
    v_activated := true;
  END IF;

  -- Activate any pending founders if the app is now live.
  IF v_activated OR (c.activated_at IS NOT NULL AND c.launch_mode = 'live') THEN
    v_founders_activated := public.activate_pending_founders(COALESCE(v_launch_at, c.activated_at, now()));
  END IF;

  -- Always run expiration sweep — cheap and idempotent.
  v_founders_expired := public.expire_founders_due();

  RETURN jsonb_build_object(
    'ok', true,
    'activated', v_activated,
    'founders_activated', v_founders_activated,
    'founders_expired', v_founders_expired,
    'now', now(),
    'launch_at', c.launch_at,
    'mode', c.launch_mode::text
  );
END $$;

GRANT EXECUTE ON FUNCTION public.activate_launch_if_due() TO anon, authenticated, service_role;

-- 9) Unified Pro entitlement
CREATE OR REPLACE FUNCTION public.has_pro_access(_user_id uuid, _env text DEFAULT 'live')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_active_subscription(_user_id, _env)
    OR EXISTS (
      SELECT 1 FROM public.founding_instructors
       WHERE user_id = _user_id
         AND founder_status = 'active'
         AND free_pro_starts_at IS NOT NULL
         AND free_pro_starts_at <= now()
         AND (free_pro_ends_at IS NULL OR free_pro_ends_at > now())
    );
$$;

GRANT EXECUTE ON FUNCTION public.has_pro_access(uuid, text) TO anon, authenticated, service_role;

-- 10) Self-read RPC: caller's founder status (handy for client)
CREATE OR REPLACE FUNCTION public.get_my_founder_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.founding_instructors%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO r FROM public.founding_instructors WHERE user_id = auth.uid();
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN to_jsonb(r);
END $$;

GRANT EXECUTE ON FUNCTION public.get_my_founder_status() TO authenticated, service_role;

-- 11) Admin helpers
CREATE OR REPLACE FUNCTION public.admin_grant_founder(_user_id uuid, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb; v_row public.founding_instructors%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  v := public.qualify_founding_instructor(_user_id);
  IF v IS NULL THEN
    RAISE EXCEPTION 'Could not grant founder (cap reached or ineligible)';
  END IF;
  IF _note IS NOT NULL THEN
    UPDATE public.founding_instructors
       SET notes = _note, granted_by = auth.uid(), updated_at = now()
     WHERE user_id = _user_id
    RETURNING * INTO v_row;
    v := to_jsonb(v_row);
  END IF;
  RETURN v;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_grant_founder(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_revoke_founder(_user_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.founding_instructors%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  UPDATE public.founding_instructors
     SET founder_status = 'revoked',
         revoked_at = now(),
         revoked_reason = _reason,
         updated_at = now()
   WHERE user_id = _user_id
  RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Founder record not found'; END IF;

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (_user_id::text, 'founder_revoked',
          'Founding Instructor status revoked',
          COALESCE(_reason, 'Your founder status was revoked by an administrator.'),
          '/instructor/subscription');

  RETURN to_jsonb(r);
END $$;

GRANT EXECUTE ON FUNCTION public.admin_revoke_founder(uuid, text) TO authenticated, service_role;

-- 12) Backfill: any instructors who already completed onboarding (and aren't test accounts)
-- get founder slots up to the cap, in order of onboarding completion.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.id
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'instructor'::public.app_role
     WHERE p.onboarding_completed_at IS NOT NULL
       AND NOT public.is_test_account(p.id)
       AND NOT EXISTS (SELECT 1 FROM public.founding_instructors fi WHERE fi.user_id = p.id)
     ORDER BY p.onboarding_completed_at ASC
  LOOP
    PERFORM public.qualify_founding_instructor(r.id);
  END LOOP;
END $$;
