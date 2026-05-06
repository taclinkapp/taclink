
-- Auto-confirm email for QA test accounts so onboarding flow can be tested
-- end-to-end without needing to click an email link. Only applies to the
-- qa+{role}-...@taclink.test pattern produced by the admin generator.
CREATE OR REPLACE FUNCTION public.auto_confirm_test_account_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email IS NULL THEN RETURN NEW; END IF;
  IF NEW.email ~* '^qa\+(instructor|student)-' AND NEW.email ~* '@taclink\.test$' THEN
    IF NEW.email_confirmed_at IS NULL THEN
      NEW.email_confirmed_at := now();
    END IF;
    IF NEW.confirmed_at IS NULL THEN
      NEW.confirmed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_before_insert_autoconfirm_test ON auth.users;
CREATE TRIGGER on_auth_user_before_insert_autoconfirm_test
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_test_account_email();
