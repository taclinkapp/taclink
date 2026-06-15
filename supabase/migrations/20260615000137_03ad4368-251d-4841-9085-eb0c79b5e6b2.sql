
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
  v_requested_role text;
  v_display_name text;
  v_referral_code text;
  v_referrer record;
  v_inf_slug text;
  v_inf_link record;
  v_dob date;
BEGIN
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  v_requested_role := lower(trim(COALESCE(NEW.raw_user_meta_data->>'role', '')));

  IF v_requested_role NOT IN ('instructor', 'student') THEN
    RAISE EXCEPTION 'Invalid signup role: "%". Signup must specify role=instructor or role=student.', v_requested_role
      USING ERRCODE = 'check_violation';
  END IF;

  v_role := v_requested_role::public.app_role;

  -- Students: require DOB and enforce 18+
  IF v_role = 'student' THEN
    BEGIN
      v_dob := NULLIF(NEW.raw_user_meta_data->>'date_of_birth', '')::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid date_of_birth format; expected YYYY-MM-DD'
        USING ERRCODE = 'check_violation';
    END;

    IF v_dob IS NULL THEN
      RAISE EXCEPTION 'date_of_birth is required for student signup'
        USING ERRCODE = 'check_violation';
    END IF;

    IF v_dob > (CURRENT_DATE - INTERVAL '18 years') THEN
      RAISE EXCEPTION 'You must be at least 18 years old to create a student account.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, display_name, photo_url, phone, state, bio, date_of_birth)
  VALUES (
    NEW.id, v_display_name,
    NEW.raw_user_meta_data->>'photo_url',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'state',
    NEW.raw_user_meta_data->>'bio',
    v_dob
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    photo_url = EXCLUDED.photo_url,
    phone = EXCLUDED.phone,
    state = EXCLUDED.state,
    bio = EXCLUDED.bio,
    date_of_birth = COALESCE(EXCLUDED.date_of_birth, public.profiles.date_of_birth);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Preserve remainder of original function body for referral/influencer logic
  v_referral_code := NULLIF(trim(NEW.raw_user_meta_data->>'referral_code'), '');
  IF v_referral_code IS NOT NULL THEN
    SELECT * INTO v_referrer FROM public.referral_codes WHERE upper(code) = upper(v_referral_code) LIMIT 1;
    IF FOUND THEN
      INSERT INTO public.referrals (referrer_id, referred_id, code)
      VALUES (v_referrer.user_id, NEW.id, upper(v_referral_code))
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  v_inf_slug := NULLIF(trim(NEW.raw_user_meta_data->>'influencer_slug'), '');
  IF v_inf_slug IS NOT NULL THEN
    SELECT * INTO v_inf_link FROM public.influencer_links WHERE lower(slug) = lower(v_inf_slug) LIMIT 1;
    IF FOUND THEN
      INSERT INTO public.influencer_link_signups (link_id, user_id)
      VALUES (v_inf_link.id, NEW.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
