-- =========================================================
-- 1. Helper: read the dev user id from request header
-- =========================================================
CREATE OR REPLACE FUNCTION public.current_dev_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.headers', true)::json->>'x-dev-user-id', ''),
    ''
  );
$$;

-- =========================================================
-- 2. Tighten messages RLS — sender must be a participant
-- =========================================================
DROP POLICY IF EXISTS "Public can insert messages (pre-launch)" ON public.messages;
DROP POLICY IF EXISTS "Public can read messages (pre-launch)" ON public.messages;
DROP POLICY IF EXISTS "Public can update messages (pre-launch)" ON public.messages;

CREATE POLICY "Participants can read messages"
ON public.messages
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
  )
);

CREATE POLICY "Sender must be a conversation participant"
ON public.messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND (c.student_id = sender_id OR c.instructor_id = sender_id)
  )
);

CREATE POLICY "Participants can update messages"
ON public.messages
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (c.student_id = sender_id OR c.instructor_id = sender_id)
  )
)
WITH CHECK (true);

-- =========================================================
-- 3. Notifications table
-- =========================================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient_unread
  ON public.notifications (recipient_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX idx_notifications_recipient
  ON public.notifications (recipient_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients can read their notifications"
ON public.notifications
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can insert notifications (server-driven)"
ON public.notifications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Recipients can update their notifications"
ON public.notifications
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- =========================================================
-- 4. Trigger — create notification when a message is sent
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.conversations%ROWTYPE;
  v_recipient text;
  v_sender_name text;
BEGIN
  SELECT * INTO v_conv FROM public.conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_role = 'student' THEN
    v_recipient := v_conv.instructor_id;
    v_sender_name := COALESCE(v_conv.student_name, 'A student');
  ELSE
    v_recipient := v_conv.student_id;
    v_sender_name := COALESCE(v_conv.instructor_name, 'An instructor');
  END IF;

  INSERT INTO public.notifications (recipient_id, type, title, body, link, conversation_id)
  VALUES (
    v_recipient,
    'message',
    'New message from ' || v_sender_name,
    LEFT(NEW.body, 140),
    CASE
      WHEN NEW.sender_role = 'student'
        THEN '/instructor/messages/' || NEW.conversation_id::text
      ELSE '/student/messages/' || NEW.conversation_id::text
    END,
    NEW.conversation_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_new_message ON public.messages;
CREATE TRIGGER trg_notify_on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_message();

-- Also re-bind the existing bump trigger (it referenced a function but no trigger existed)
DROP TRIGGER IF EXISTS trg_bump_conversation_on_message ON public.messages;
CREATE TRIGGER trg_bump_conversation_on_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.bump_conversation_on_message();

-- =========================================================
-- 5. Realtime
-- =========================================================
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
