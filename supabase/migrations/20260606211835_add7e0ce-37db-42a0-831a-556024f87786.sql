
ALTER TABLE public.feedback_submissions
  ADD COLUMN IF NOT EXISTS submitter_user_id uuid;
ALTER TABLE public.issue_reports
  ADD COLUMN IF NOT EXISTS reporter_user_id uuid;

UPDATE public.feedback_submissions f
SET submitter_user_id = u.id
FROM auth.users u
WHERE f.submitter_user_id IS NULL
  AND f.submitter_email IS NOT NULL
  AND lower(u.email) = lower(f.submitter_email);

UPDATE public.issue_reports i
SET reporter_user_id = u.id
FROM auth.users u
WHERE i.reporter_user_id IS NULL
  AND i.reporter_email IS NOT NULL
  AND lower(u.email) = lower(i.reporter_email);

DROP POLICY IF EXISTS "Submitters and admins can read feedback" ON public.feedback_submissions;
CREATE POLICY "Submitters and admins can read feedback"
ON public.feedback_submissions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (submitter_user_id IS NOT NULL AND submitter_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Submitters and admins can read issue reports" ON public.issue_reports;
CREATE POLICY "Submitters and admins can read issue reports"
ON public.issue_reports
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (reporter_user_id IS NOT NULL AND reporter_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback_submissions;
CREATE POLICY "Anyone can submit feedback"
ON public.feedback_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  submitter_user_id IS NULL
  OR submitter_user_id = auth.uid()
);

DROP POLICY IF EXISTS "Anyone can submit an issue report" ON public.issue_reports;
CREATE POLICY "Anyone can submit an issue report"
ON public.issue_reports
FOR INSERT
TO anon, authenticated
WITH CHECK (
  reporter_user_id IS NULL
  OR reporter_user_id = auth.uid()
);

-- Realtime policy for conv-<id> topics (student_id/instructor_id are text)
DROP POLICY IF EXISTS "Conversation participants can subscribe to conv-<id> topic"
  ON realtime.messages;

CREATE POLICY "Conversation participants can subscribe to conv-<id> topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'conv-%'
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id::text = substring(realtime.topic() FROM 6)
      AND (auth.uid()::text = c.student_id OR auth.uid()::text = c.instructor_id)
  )
);

-- Internal token table for DB-trigger -> ai-propose
CREATE TABLE IF NOT EXISTS public._ai_internal_tokens (
  name text PRIMARY KEY,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public._ai_internal_tokens FROM PUBLIC;
GRANT ALL ON public._ai_internal_tokens TO service_role;

ALTER TABLE public._ai_internal_tokens ENABLE ROW LEVEL SECURITY;

INSERT INTO public._ai_internal_tokens (name, token)
VALUES ('ai_propose', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public._ai_propose_headers()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'Content-Type', 'application/json',
    'x-ai-internal-token', (SELECT token FROM public._ai_internal_tokens WHERE name = 'ai_propose')
  );
$$;

REVOKE ALL ON FUNCTION public._ai_propose_headers() FROM PUBLIC;

-- Patch trigger functions to send the internal token header.
DO $$
DECLARE
  fn text;
  def text;
  new_def text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'queue_ai_review_moderation',
    'queue_ai_credential_review',
    'queue_ai_message_reply',
    'queue_ai_dispute_triage',
    'queue_ai_course_moderation'
  ] LOOP
    SELECT pg_get_functiondef(p.oid)
      INTO def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = fn;

    IF def IS NULL THEN CONTINUE; END IF;

    new_def := regexp_replace(
      def,
      'headers\s*:=\s*''[^'']*''::jsonb',
      'headers := public._ai_propose_headers()',
      'g'
    );

    IF new_def <> def THEN EXECUTE new_def; END IF;
  END LOOP;
END $$;
