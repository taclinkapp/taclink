
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.queue_ai_message_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.conversations%ROWTYPE;
  v_existing int;
  v_recent_msgs jsonb;
  v_payload jsonb;
  v_url text;
BEGIN
  -- Only auto-draft when a student sends a message (the instructor is the typical bottleneck).
  IF NEW.sender_role <> 'student' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_conv FROM public.conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Skip if there's already a pending or auto-paused AI draft for this conversation.
  SELECT count(*) INTO v_existing
    FROM public.ai_actions
   WHERE kind = 'message_reply'
     AND target_id = NEW.conversation_id::text
     AND status IN ('proposed', 'auto_paused', 'approved');
  IF v_existing > 0 THEN
    RETURN NEW;
  END IF;

  -- Pull last 6 messages for context.
  SELECT jsonb_agg(jsonb_build_object(
    'role', m.sender_role,
    'body', m.body,
    'at', m.created_at
  ) ORDER BY m.created_at)
    INTO v_recent_msgs
    FROM (
      SELECT * FROM public.messages
       WHERE conversation_id = NEW.conversation_id
       ORDER BY created_at DESC
       LIMIT 6
    ) m;

  v_payload := jsonb_build_object(
    'kind', 'message_reply',
    'target_type', 'conversation',
    'target_id', NEW.conversation_id::text,
    'context', jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'course_title', v_conv.course_title,
      'student_name', v_conv.student_name,
      'instructor_name', v_conv.instructor_name,
      'recent_messages', v_recent_msgs,
      'latest_message', NEW.body
    )
  );

  v_url := current_setting('app.supabase_url', true);
  IF v_url IS NULL OR v_url = '' THEN
    v_url := 'https://jocnlpkbaqmriedmbocl.supabase.co';
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/ai-propose',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := v_payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block message insertion on AI failure.
  RAISE WARNING 'queue_ai_message_reply failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_ai_message_reply ON public.messages;
CREATE TRIGGER trg_queue_ai_message_reply
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.queue_ai_message_reply();
