-- 1. Enum for launch mode
DO $$ BEGIN
  CREATE TYPE public.app_launch_mode AS ENUM ('prelaunch', 'live', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Singleton config table
CREATE TABLE IF NOT EXISTS public.launch_config (
  id boolean PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  launch_mode public.app_launch_mode NOT NULL DEFAULT 'prelaunch',
  launch_at timestamptz,
  manual_override boolean NOT NULL DEFAULT false,
  countdown_enabled boolean NOT NULL DEFAULT true,
  bookings_enabled boolean NOT NULL DEFAULT false,
  course_creation_enabled boolean NOT NULL DEFAULT true,
  publish_enabled boolean NOT NULL DEFAULT false,
  pro_unlock_enabled boolean NOT NULL DEFAULT false,
  waitlist_enabled boolean NOT NULL DEFAULT true,
  maintenance_message text,
  activated_at timestamptz,
  activated_by uuid,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  last_updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Explicit grants (per project rule for Oct 30, 2026 Data API change)
GRANT SELECT ON public.launch_config TO anon;
GRANT SELECT, UPDATE ON public.launch_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.launch_config TO service_role;

ALTER TABLE public.launch_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "launch_config readable by all" ON public.launch_config;
CREATE POLICY "launch_config readable by all"
  ON public.launch_config FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "launch_config admin write" ON public.launch_config;
CREATE POLICY "launch_config admin write"
  ON public.launch_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "launch_config admin insert" ON public.launch_config;
CREATE POLICY "launch_config admin insert"
  ON public.launch_config FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. last_updated_at touch trigger
CREATE OR REPLACE FUNCTION public.touch_launch_config()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.last_updated_at = now();
  NEW.last_updated_by = COALESCE(auth.uid(), NEW.last_updated_by);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_launch_config ON public.launch_config;
CREATE TRIGGER trg_touch_launch_config
  BEFORE UPDATE ON public.launch_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_launch_config();

-- 4. Seed singleton from existing platform_settings
INSERT INTO public.launch_config (id, launch_mode, launch_at, bookings_enabled, publish_enabled, pro_unlock_enabled, waitlist_enabled, countdown_enabled, course_creation_enabled)
SELECT
  TRUE,
  CASE WHEN (SELECT value::text FROM public.platform_settings WHERE key='prelaunch_mode') IN ('true','"true"') THEN 'prelaunch'::public.app_launch_mode
       ELSE 'live'::public.app_launch_mode END,
  COALESCE(
    NULLIF((SELECT value #>> '{}' FROM public.platform_settings WHERE key='launch_date'), '')::timestamptz,
    now() + interval '30 days'
  ),
  -- if currently NOT prelaunch, bookings/publish/pro should be on
  CASE WHEN (SELECT value::text FROM public.platform_settings WHERE key='prelaunch_mode') IN ('true','"true"') THEN false ELSE true END,
  CASE WHEN (SELECT value::text FROM public.platform_settings WHERE key='prelaunch_mode') IN ('true','"true"') THEN false ELSE true END,
  CASE WHEN (SELECT value::text FROM public.platform_settings WHERE key='prelaunch_mode') IN ('true','"true"') THEN false ELSE true END,
  CASE WHEN (SELECT value::text FROM public.platform_settings WHERE key='prelaunch_mode') IN ('true','"true"') THEN true ELSE false END,
  true,
  true
ON CONFLICT (id) DO NOTHING;

-- 5. Effective state RPC — pure read, cheap to call from clients.
CREATE OR REPLACE FUNCTION public.get_effective_launch_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.launch_config%ROWTYPE;
  v_mode public.app_launch_mode;
  v_bookings boolean;
  v_publish boolean;
  v_create boolean;
  v_pro boolean;
  v_waitlist boolean;
BEGIN
  SELECT * INTO c FROM public.launch_config WHERE id = TRUE;
  IF NOT FOUND THEN
    -- Fail safe: prelaunch with everything locked
    RETURN jsonb_build_object(
      'mode', 'prelaunch',
      'launch_at', NULL,
      'manual_override', false,
      'countdown_enabled', true,
      'bookings_enabled', false,
      'course_creation_enabled', false,
      'publish_enabled', false,
      'pro_unlock_enabled', false,
      'waitlist_enabled', true,
      'maintenance_message', NULL,
      'activated_at', NULL,
      'server_time', now()
    );
  END IF;

  -- Compute effective mode: auto-promote prelaunch -> live once launch_at passes,
  -- unless manually overridden. Paused always wins.
  IF c.launch_mode = 'paused' THEN
    v_mode := 'paused';
  ELSIF c.manual_override THEN
    v_mode := c.launch_mode;
  ELSIF c.launch_mode = 'prelaunch' AND c.launch_at IS NOT NULL AND c.launch_at <= now() THEN
    v_mode := 'live';
  ELSE
    v_mode := c.launch_mode;
  END IF;

  -- When effective mode is live, transactional flags default ON unless an admin
  -- has explicitly turned them off. When prelaunch, they stay as configured
  -- (which defaults to locked).
  IF v_mode = 'live' THEN
    v_bookings := c.bookings_enabled OR NOT c.manual_override;
    v_publish := c.publish_enabled OR NOT c.manual_override;
    v_create := c.course_creation_enabled;
    v_pro := c.pro_unlock_enabled OR NOT c.manual_override;
    v_waitlist := false;
  ELSIF v_mode = 'paused' THEN
    v_bookings := false;
    v_publish := false;
    v_create := c.course_creation_enabled; -- creating drafts can stay allowed
    v_pro := c.pro_unlock_enabled;
    v_waitlist := c.waitlist_enabled;
  ELSE -- prelaunch
    v_bookings := c.bookings_enabled;
    v_publish := c.publish_enabled;
    v_create := c.course_creation_enabled;
    v_pro := c.pro_unlock_enabled;
    v_waitlist := c.waitlist_enabled;
  END IF;

  RETURN jsonb_build_object(
    'mode', v_mode::text,
    'configured_mode', c.launch_mode::text,
    'launch_at', c.launch_at,
    'manual_override', c.manual_override,
    'countdown_enabled', c.countdown_enabled,
    'bookings_enabled', v_bookings,
    'course_creation_enabled', v_create,
    'publish_enabled', v_publish,
    'pro_unlock_enabled', v_pro,
    'waitlist_enabled', v_waitlist,
    'maintenance_message', c.maintenance_message,
    'activated_at', c.activated_at,
    'server_time', now()
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_effective_launch_state() TO anon, authenticated, service_role;

-- 6. Idempotent activation routine — called by cron edge function.
CREATE OR REPLACE FUNCTION public.activate_launch_if_due()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.launch_config%ROWTYPE;
  v_activated boolean := false;
BEGIN
  SELECT * INTO c FROM public.launch_config WHERE id = TRUE FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_config');
  END IF;

  -- Only auto-activate when: not paused, not manually held, prelaunch, due, and not previously stamped.
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
     WHERE id = TRUE AND activated_at IS NULL;
    v_activated := true;
  END IF;

  RETURN jsonb_build_object('ok', true, 'activated', v_activated, 'now', now(),
    'launch_at', c.launch_at, 'mode', c.launch_mode::text);
END $$;

GRANT EXECUTE ON FUNCTION public.activate_launch_if_due() TO anon, authenticated, service_role;

-- 7. Extend publish enforcement to honor publish_enabled flag.
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
  v_state jsonb;
  v_publish_enabled boolean;
  v_mode text;
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    -- QA test instructors exempt from all gating
    IF public.is_test_account(NEW.instructor_id) THEN
      RETURN NEW;
    END IF;

    -- Launch gating: block publish when publish flag is off and instructor is not admin.
    v_state := public.get_effective_launch_state();
    v_publish_enabled := COALESCE((v_state->>'publish_enabled')::boolean, false);
    v_mode := v_state->>'mode';
    IF NOT v_publish_enabled AND NOT public.has_role(NEW.instructor_id, 'admin'::public.app_role) THEN
      IF v_mode = 'paused' THEN
        RAISE EXCEPTION 'Publishing is paused for maintenance. Please try again shortly.'
          USING ERRCODE = 'check_violation';
      ELSE
        RAISE EXCEPTION 'Publishing unlocks on launch day. You can save drafts now and publish then.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

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
END $$;
