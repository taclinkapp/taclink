CREATE OR REPLACE FUNCTION public.enforce_instructor_connect_for_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_provider text;
  v_status text;
  v_method_count int;
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    -- Skip payout/connect requirements entirely for fake QA test instructor
    -- accounts so admins can seed courses during pre-launch.
    IF public.is_test_account(NEW.instructor_id) THEN
      RETURN NEW;
    END IF;

    SELECT active_provider INTO v_provider FROM public.payment_provider_settings WHERE id = TRUE;

    IF v_provider = 'helcim' THEN
      SELECT count(*) INTO v_method_count FROM public.instructor_payout_methods WHERE instructor_id = NEW.instructor_id;
      IF v_method_count = 0 THEN
        RAISE EXCEPTION 'You must add a payout method before publishing a course. Go to Settings → Payout Methods to add one.'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      SELECT stripe_connect_status INTO v_status FROM public.profiles WHERE id = NEW.instructor_id;
      IF v_status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'You must complete payout setup before publishing a course. Go to Settings → Payout Methods to finish onboarding.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;