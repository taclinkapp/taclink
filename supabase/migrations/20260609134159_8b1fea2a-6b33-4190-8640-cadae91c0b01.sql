
ALTER TABLE public.seo_topics
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

CREATE INDEX IF NOT EXISTS seo_topics_autopublish_idx
  ON public.seo_topics (status, priority DESC, scheduled_for NULLS FIRST, created_at);
