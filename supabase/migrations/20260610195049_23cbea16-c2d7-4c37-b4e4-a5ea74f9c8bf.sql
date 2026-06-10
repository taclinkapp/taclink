CREATE OR REPLACE FUNCTION public.promote_pending_test_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_pending public.pending_test_accounts%ROWTYPE;
  v_role text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.id;
  IF v_email IS NULL THEN RETURN NEW; END IF;

  -- 1) Explicit allowlist match
  SELECT * INTO v_pending FROM public.pending_test_accounts WHERE lower(email) = lower(v_email);
  IF FOUND THEN
    IF NOT EXISTS (SELECT 1 FROM public.test_accounts WHERE user_id = NEW.id) THEN
      INSERT INTO public.test_accounts (user_id, email, role, label, created_by)
      VALUES (NEW.id, v_email, v_pending.role, COALESCE(v_pending.label, 'pending allowlist'), NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  -- 2) Auto-promote QA generator pattern: qa+<role>-...@taclink.test
  IF lower(v_email) LIKE 'qa+instructor-%@taclink.test' THEN
    v_role := 'instructor';
  ELSIF lower(v_email) LIKE 'qa+student-%@taclink.test' THEN
    v_role := 'student';
  ELSE
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.test_accounts WHERE user_id = NEW.id) THEN
    INSERT INTO public.test_accounts (user_id, email, role, label, created_by)
    VALUES (NEW.id, v_email, v_role, 'qa signup generator', NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;