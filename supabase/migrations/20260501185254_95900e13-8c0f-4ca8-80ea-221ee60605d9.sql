DO $$
DECLARE
  v_student_id uuid := '11111111-1111-1111-1111-111111111111';
  v_instructor_id uuid := '22222222-2222-2222-2222-222222222222';
  v_password text := crypt('DevPass123!', gen_salt('bf'));
BEGIN
  -- Clean any partial leftover (in case email exists with different id)
  DELETE FROM auth.users WHERE email IN ('student@dev.taclink.local','instructor@dev.taclink.local') AND id NOT IN (v_student_id, v_instructor_id);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_student_id) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_sso_user
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_student_id, 'authenticated', 'authenticated',
      'student@dev.taclink.local', v_password,
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Dev Student","role":"student"}'::jsonb,
      false
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_student_id,
      jsonb_build_object('sub', v_student_id::text, 'email', 'student@dev.taclink.local'),
      'email', v_student_id::text, now(), now(), now());
  ELSE
    -- Reset password and clear any ban so login works again
    UPDATE auth.users
    SET encrypted_password = v_password,
        banned_until = NULL,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_student_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_instructor_id) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_sso_user
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_instructor_id, 'authenticated', 'authenticated',
      'instructor@dev.taclink.local', v_password,
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Dev Instructor","role":"instructor"}'::jsonb,
      false
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_instructor_id,
      jsonb_build_object('sub', v_instructor_id::text, 'email', 'instructor@dev.taclink.local'),
      'email', v_instructor_id::text, now(), now(), now());
  ELSE
    UPDATE auth.users
    SET encrypted_password = v_password,
        banned_until = NULL,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_instructor_id;
  END IF;
END $$;

INSERT INTO public.profiles (id, display_name, account_status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Dev Student', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Dev Instructor', 'active')
ON CONFLICT (id) DO UPDATE SET account_status = 'active';

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'student'),
  ('22222222-2222-2222-2222-222222222222', 'instructor')
ON CONFLICT (user_id, role) DO NOTHING;