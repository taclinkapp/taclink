CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_name TEXT,
  student_photo TEXT,
  instructor_id TEXT NOT NULL,
  instructor_name TEXT,
  instructor_photo TEXT,
  course_id TEXT,
  course_title TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, instructor_id, course_id)
);

CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('student','instructor')),
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation_created
  ON public.messages(conversation_id, created_at);
CREATE INDEX idx_conversations_student
  ON public.conversations(student_id, last_message_at DESC);
CREATE INDEX idx_conversations_instructor
  ON public.conversations(instructor_id, last_message_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read conversations (pre-launch)"
  ON public.conversations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can insert conversations (pre-launch)"
  ON public.conversations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can update conversations (pre-launch)"
  ON public.conversations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public can read messages (pre-launch)"
  ON public.messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can insert messages (pre-launch)"
  ON public.messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can update messages (pre-launch)"
  ON public.messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.bump_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
     SET last_message = NEW.body,
         last_message_at = NEW.created_at,
         updated_at = now()
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_messages_bump_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_on_message();

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;