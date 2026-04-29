
-- Phase 2: Auto-queue AI proposals for credentials, courses, reviews, and refund requests.

-- ===== Credentials =====
CREATE OR REPLACE FUNCTION public.queue_ai_credential_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing int;
  v_url text;
  v_payload jsonb;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_existing FROM public.ai_actions
   WHERE kind = 'credential_verify'
     AND target_id = NEW.id::text
     AND status IN ('proposed','auto_paused','approved');
  IF v_existing > 0 THEN RETURN NEW; END IF;

  v_payload := jsonb_build_object(
    'kind','credential_verify',
    'target_type','instructor_credential',
    'target_id', NEW.id::text,
    'context', jsonb_build_object(
      'credential_id', NEW.id,
      'instructor_id', NEW.instructor_id,
      'credential_type', NEW.credential_type,
      'display_name', NEW.display_name,
      'ai_confidence', NEW.ai_confidence,
      'ai_issuer', NEW.ai_issuer,
      'ai_holder_name', NEW.ai_holder_name,
      'ai_expires_on', NEW.ai_expires_on,
      'ai_reasons', NEW.ai_reasons
    )
  );

  v_url := COALESCE(NULLIF(current_setting('app.supabase_url', true),''),
                    'https://jocnlpkbaqmriedmbocl.supabase.co');
  PERFORM net.http_post(
    url := v_url || '/functions/v1/ai-propose',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := v_payload
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'queue_ai_credential_review failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_ai_credential_review ON public.instructor_credentials;
CREATE TRIGGER trg_queue_ai_credential_review
AFTER INSERT ON public.instructor_credentials
FOR EACH ROW EXECUTE FUNCTION public.queue_ai_credential_review();

-- ===== Courses =====
CREATE OR REPLACE FUNCTION public.queue_ai_course_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing int;
  v_url text;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.title IS NOT DISTINCT FROM OLD.title
     AND NEW.description IS NOT DISTINCT FROM OLD.description THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_existing FROM public.ai_actions
   WHERE kind = 'course_moderation'
     AND target_id = NEW.id::text
     AND status IN ('proposed','auto_paused','approved');
  IF v_existing > 0 THEN RETURN NEW; END IF;

  v_payload := jsonb_build_object(
    'kind','course_moderation',
    'target_type','course',
    'target_id', NEW.id::text,
    'context', jsonb_build_object(
      'course_id', NEW.id,
      'title', NEW.title,
      'description', NEW.description,
      'category', NEW.category,
      'price_cents', NEW.price_cents,
      'city', NEW.city,
      'state', NEW.state
    )
  );

  v_url := COALESCE(NULLIF(current_setting('app.supabase_url', true),''),
                    'https://jocnlpkbaqmriedmbocl.supabase.co');
  PERFORM net.http_post(
    url := v_url || '/functions/v1/ai-propose',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := v_payload
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'queue_ai_course_moderation failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_ai_course_moderation ON public.courses;
CREATE TRIGGER trg_queue_ai_course_moderation
AFTER INSERT OR UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.queue_ai_course_moderation();

-- ===== Reviews =====
CREATE OR REPLACE FUNCTION public.queue_ai_review_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing int;
  v_url text;
  v_payload jsonb;
BEGIN
  IF NEW.comment IS NULL OR length(trim(NEW.comment)) < 5 THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_existing FROM public.ai_actions
   WHERE kind = 'review_moderation'
     AND target_id = NEW.id::text
     AND status IN ('proposed','auto_paused','approved');
  IF v_existing > 0 THEN RETURN NEW; END IF;

  v_payload := jsonb_build_object(
    'kind','review_moderation',
    'target_type','review',
    'target_id', NEW.id::text,
    'context', jsonb_build_object(
      'review_id', NEW.id,
      'rating', NEW.rating,
      'comment', NEW.comment
    )
  );

  v_url := COALESCE(NULLIF(current_setting('app.supabase_url', true),''),
                    'https://jocnlpkbaqmriedmbocl.supabase.co');
  PERFORM net.http_post(
    url := v_url || '/functions/v1/ai-propose',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := v_payload
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'queue_ai_review_moderation failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_ai_review_moderation ON public.reviews;
CREATE TRIGGER trg_queue_ai_review_moderation
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.queue_ai_review_moderation();
