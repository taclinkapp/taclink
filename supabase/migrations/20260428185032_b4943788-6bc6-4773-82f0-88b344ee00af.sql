-- Add moderation status to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderation_severity text;

-- Add moderation status to courses
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderation_severity text;

-- Flagged content queue
CREATE TABLE IF NOT EXISTS public.flagged_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL, -- 'message' | 'course_text' | 'course_image' | 'review_image'
  content_id uuid,            -- id of the source row (message.id, course.id, review.id)
  conversation_id uuid,       -- optional, for messages
  course_id uuid,             -- optional
  author_id text,             -- the user who created the content (text to match conversations schema)
  author_role text,
  category text NOT NULL,     -- 'sexual' | 'violence' | 'contact_share' | 'off_platform' | 'harassment' | 'other'
  severity text NOT NULL DEFAULT 'medium', -- 'low' | 'medium' | 'high'
  reason text,
  excerpt text,               -- redacted snippet or filename
  image_url text,
  ai_raw jsonb,               -- raw model response for audit
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'removed' | 'dismissed'
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flagged_content ENABLE ROW LEVEL SECURITY;

-- Admins manage everything
CREATE POLICY "Admins manage flagged content"
  ON public.flagged_content FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Server-side (edge function) inserts via service role bypass RLS automatically;
-- we still allow authenticated inserts so the edge function can also operate
-- under the user's JWT if needed.
CREATE POLICY "Authenticated can insert flagged content"
  ON public.flagged_content FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authors can view their own flagged content
CREATE POLICY "Authors can view their own flags"
  ON public.flagged_content FOR SELECT
  TO authenticated
  USING (author_id = auth.uid()::text);

CREATE TRIGGER set_flagged_content_updated_at
BEFORE UPDATE ON public.flagged_content
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_flagged_content_status ON public.flagged_content(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flagged_content_type ON public.flagged_content(content_type);