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
BEGIN
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Strict server-side validation: requested role must be explicitly
  -- 'instructor' or 'student'. Anything else (missing, 'admin', typos,
  -- unknown values) is rejected outright to prevent flow cross-over.
  v_requested_role := lower(trim(COALESCE(NEW.raw_user_meta_data->>'role', '')));

  IF v_requested_role NOT IN ('instructor', 'student') THEN
    RAISE EXCEPTION 'Invalid signup role: "%". Signup must specify role=instructor or role=student.', v_requested_role
      USING ERRCODE = 'check_violation';
  END IF;

  v_role := v_requested_role::public.app_role;

  INSERT INTO public.profiles (id, display_name, photo_url, phone, state, bio)
  VALUES (
    NEW.id, v_display_name,
    NEW.raw_user_meta_data->>'photo_url',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'state',
    NEW.raw_user_meta_data->>'bio'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    photo_url = EXCLUDED.photo_url,
    phone = EXCLUDED.phone,
    state = EXCLUDED.state,
    bio = EXCLUDED.bio;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.referral_codes (user_id, user_role, code)
  VALUES (NEW.id, v_role, public.generate_referral_code())
  ON CONFLICT (user_id) DO NOTHING;

  v_referral_code := UPPER(NULLIF(NEW.raw_user_meta_data->>'referral_code', ''));
  IF v_referral_code IS NOT NULL THEN
    SELECT user_id, user_role INTO v_referrer
      FROM public.referral_codes WHERE code = v_referral_code;
    IF FOUND AND v_referrer.user_id <> NEW.id THEN
      INSERT INTO public.referrals (referrer_id, referrer_role, referred_user_id, code_used, status)
      VALUES (v_referrer.user_id, v_referrer.user_role, NEW.id, v_referral_code, 'pending')
      ON CONFLICT (referred_user_id) DO NOTHING;
    END IF;
  END IF;

  v_inf_slug := LOWER(NULLIF(NEW.raw_user_meta_data->>'influencer_slug', ''));
  IF v_inf_slug IS NOT NULL THEN
    SELECT id, audience, active INTO v_inf_link
      FROM public.influencer_links WHERE slug = v_inf_slug;
    IF FOUND AND v_inf_link.active
       AND (v_inf_link.audience = 'both' OR v_inf_link.audience = v_role::text) THEN
      INSERT INTO public.influencer_link_signups (link_id, user_id, user_role)
      VALUES (v_inf_link.id, NEW.id, v_role)
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;