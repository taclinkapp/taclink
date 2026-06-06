
-- ============= seo_topics =============
CREATE TABLE public.seo_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  target_keyword TEXT,
  location TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | generating | done | failed
  article_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_topics TO authenticated;
GRANT ALL ON public.seo_topics TO service_role;

ALTER TABLE public.seo_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage seo_topics"
ON public.seo_topics FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============= seo_articles =============
CREATE TABLE public.seo_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  body_markdown TEXT NOT NULL DEFAULT '',
  meta_description TEXT,
  target_keyword TEXT,
  keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | published | archived
  published_at TIMESTAMPTZ,
  topic_id UUID REFERENCES public.seo_topics(id) ON DELETE SET NULL,
  model TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.seo_articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_articles TO authenticated;
GRANT ALL ON public.seo_articles TO service_role;

ALTER TABLE public.seo_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published articles"
ON public.seo_articles FOR SELECT
TO anon, authenticated
USING (status = 'published');

CREATE POLICY "Admins can read all articles"
ON public.seo_articles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert articles"
ON public.seo_articles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update articles"
ON public.seo_articles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete articles"
ON public.seo_articles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX seo_articles_status_published_at_idx
  ON public.seo_articles (status, published_at DESC);

-- updated_at triggers (reuse existing function if present; else create)
CREATE OR REPLACE FUNCTION public.tg_seo_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER seo_topics_set_updated_at
  BEFORE UPDATE ON public.seo_topics
  FOR EACH ROW EXECUTE FUNCTION public.tg_seo_set_updated_at();

CREATE TRIGGER seo_articles_set_updated_at
  BEFORE UPDATE ON public.seo_articles
  FOR EACH ROW EXECUTE FUNCTION public.tg_seo_set_updated_at();
