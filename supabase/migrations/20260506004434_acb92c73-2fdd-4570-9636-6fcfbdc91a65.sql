
-- Auto-register users who sign up with the QA test email pattern
-- so they get the test-account bypass behaviour automatically.
CREATE OR REPLACE FUNCTION public.handle_new_test_account_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text;
  v_admin uuid;
BEGIN
  IF NEW.email IS NULL THEN RETURN NEW; END IF;
  IF NEW.email !~* '^qa\+(instructor|student)-' OR NEW.email !~* '@taclink\.test$' THEN
    RETURN NEW;
  END IF;

  v_role := lower(trim(COALESCE(NEW.raw_user_meta_data->>'role', '')));
  IF v_role NOT IN ('instructor','student') THEN RETURN NEW; END IF;

  -- Pick any admin as the "created_by" owner (required NOT NULL).
  SELECT user_id INTO v_admin FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF v_admin IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.test_accounts (user_id, email, role, label, created_by)
  VALUES (NEW.id, NEW.email, v_role, 'Auto-registered via QA signup', v_admin)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_test_account ON auth.users;
CREATE TRIGGER on_auth_user_created_test_account
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_test_account_signup();
