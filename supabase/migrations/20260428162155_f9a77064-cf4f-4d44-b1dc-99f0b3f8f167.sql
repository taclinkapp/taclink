DO $$
DECLARE
  v_student_id uuid := '11111111-1111-1111-1111-111111111111';
  v_instructor_id uuid := '22222222-2222-2222-2222-222222222222';
  v_admin_id uuid := '33333333-3333-3333-3333-333333333333';
  v_password text := crypt('DevPass123!', gen_salt('bf'));
BEGIN
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
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_admin_id) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_sso_user
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated',
      'admin@dev.taclink.local', v_password,
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Dev Admin","role":"admin"}'::jsonb,
      false
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_admin_id,
      jsonb_build_object('sub', v_admin_id::text, 'email', 'admin@dev.taclink.local'),
      'email', v_admin_id::text, now(), now(), now());
  END IF;
END $$;

INSERT INTO public.profiles (id, display_name)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Dev Student'),
  ('22222222-2222-2222-2222-222222222222', 'Dev Instructor'),
  ('33333333-3333-3333-3333-333333333333', 'Dev Admin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'student'),
  ('22222222-2222-2222-2222-222222222222', 'instructor'),
  ('33333333-3333-3333-3333-333333333333', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;