
-- 1) Update qualify_founding_instructor to also mark the subscription onboarding
--    step as complete (founders don't choose a plan — Pro is free).
CREATE OR REPLACE FUNCTION public.qualify_founding_instructor(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'instructor'::public.app_role)
    INTO v_is_instructor;
  IF NOT v_is_instructor THEN RETURN NULL; END IF;

  SELECT public.is_test_account(_user_id) INTO v_is_test;
  IF v_is_test THEN RETURN NULL; END IF;

  SELECT * INTO v_existing FROM public.founding_instructors WHERE user_id = _user_id;
  IF FOUND THEN
    -- Make sure subscription step stays auto-completed for existing founders.
    UPDATE public.profiles
       SET subscription_chosen_at = COALESCE(subscription_chosen_at, now())
     WHERE id = _user_id;
    RETURN to_jsonb(v_existing);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('founding_instructors_rank'));

  SELECT * INTO v_existing FROM public.founding_instructors WHERE user_id = _user_id;
  IF FOUND THEN
    UPDATE public.profiles
       SET subscription_chosen_at = COALESCE(subscription_chosen_at, now())
     WHERE id = _user_id;
    RETURN to_jsonb(v_existing);
  END IF;

  SELECT COALESCE(MAX(founder_rank), 0) + 1 INTO v_next_rank FROM public.founding_instructors;
  IF v_next_rank > 1000 THEN
    RETURN NULL; -- 1000-founder cap reached
  END IF;

  v_state := public.get_effective_launch_state();
  v_mode := v_state->>'mode';
  v_activated_at := (v_state->>'activated_at')::timestamptz;

  IF v_mode = 'live' AND v_activated_at IS NOT NULL THEN
    v_status := 'active';
    v_starts := now();
    v_ends := now() + interval '6 months';
    v_launch_used := v_activated_at;
  ELSE
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

  -- Founders don't pick a plan — Pro is auto-granted at launch. Mark the
  -- subscription onboarding step complete so they bypass the plan picker.
  UPDATE public.profiles
     SET subscription_chosen_at = COALESCE(subscription_chosen_at, now())
   WHERE id = _user_id;

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (
    _user_id::text, 'founder_granted',
    'You''re a Founding Instructor!',
    CASE WHEN v_status = 'active'
      THEN 'Welcome — your Pro plan is free for the next 6 months.'
      ELSE 'You''re locked in as one of the first 1000. Your free 6 months of Pro starts the moment we launch.'
    END,
    '/instructor/subscription'
  );

  RETURN to_jsonb(v_new);
END
$function$;

-- 2) Trigger founder qualification on instructor role assignment so a new
--    instructor is qualified the moment they sign up (subject to the 1000 cap).
CREATE OR REPLACE FUNCTION public.tg_qualify_founder_on_role_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role = 'instructor'::public.app_role THEN
    PERFORM public.qualify_founding_instructor(NEW.user_id);
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_qualify_founder_on_role_insert ON public.user_roles;
CREATE TRIGGER trg_qualify_founder_on_role_insert
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.tg_qualify_founder_on_role_insert();

-- 3) Backfill: any existing real instructor without a founder row gets
--    qualified now (oldest signup first), up to the 1000 cap.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT ur.user_id
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
     WHERE ur.role = 'instructor'::public.app_role
       AND NOT EXISTS (SELECT 1 FROM public.founding_instructors fi WHERE fi.user_id = ur.user_id)
       AND NOT public.is_test_account(ur.user_id)
     ORDER BY p.created_at ASC
  LOOP
    PERFORM public.qualify_founding_instructor(r.user_id);
  END LOOP;
END $$;
