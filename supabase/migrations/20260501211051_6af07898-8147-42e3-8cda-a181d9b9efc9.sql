-- Grant admin role to taclink@taclinkapp.com (creates a profile row if missing)
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower('taclink@taclinkapp.com') LIMIT 1;

  IF v_uid IS NULL THEN
    RAISE NOTICE 'No auth user found for taclink@taclinkapp.com — sign up with this email first, then re-run.';
  ELSE
    INSERT INTO public.profiles (id, display_name)
    VALUES (v_uid, 'TacLink Admin')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;