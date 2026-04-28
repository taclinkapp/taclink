
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS strike_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_warning_sent_at timestamp with time zone;

-- Constrain account_status values
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_account_status_check
    CHECK (account_status IN ('active', 'warned', 'suspended'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.award_strike(_user_id uuid, _points integer DEFAULT 1)
RETURNS TABLE (new_points integer, new_status text, warning_issued boolean, suspended boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_points integer;
  v_status text;
  v_warning boolean := false;
  v_suspended boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles
     SET strike_points = COALESCE(strike_points, 0) + GREATEST(0, _points),
         updated_at = now()
   WHERE id = _user_id
   RETURNING strike_points, account_status INTO v_new_points, v_status;

  IF v_new_points IS NULL THEN
    RETURN;
  END IF;

  -- 4+ strikes: auto-suspend
  IF v_new_points >= 4 AND v_status <> 'suspended' THEN
    UPDATE public.profiles
       SET account_status = 'suspended', updated_at = now()
     WHERE id = _user_id;
    v_status := 'suspended';
    v_suspended := true;
  -- 3 strikes: final warning
  ELSIF v_new_points >= 3 AND v_status = 'active' THEN
    UPDATE public.profiles
       SET account_status = 'warned',
           final_warning_sent_at = now(),
           updated_at = now()
     WHERE id = _user_id;
    v_status := 'warned';
    v_warning := true;
  END IF;

  RETURN QUERY SELECT v_new_points, v_status, v_warning, v_suspended;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_strike(uuid, integer) TO authenticated;
