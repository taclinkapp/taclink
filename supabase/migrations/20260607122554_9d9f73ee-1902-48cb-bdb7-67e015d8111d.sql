
-- Outreach tracking
CREATE TABLE public.backlink_outreach (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_domain TEXT NOT NULL,
  target_url TEXT,
  contact_name TEXT,
  contact_email TEXT,
  outreach_type TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'planned',
  pitch_notes TEXT,
  follow_up_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  acquired_backlink_id UUID,
  linked_course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  linked_article_id UUID REFERENCES public.seo_articles(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Acquired backlinks
CREATE TABLE public.backlinks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_domain TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  target_url TEXT NOT NULL,
  anchor_text TEXT,
  link_type TEXT NOT NULL DEFAULT 'dofollow',
  domain_authority INTEGER,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  linked_course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  linked_article_id UUID REFERENCES public.seo_articles(id) ON DELETE SET NULL,
  outreach_id UUID REFERENCES public.backlink_outreach(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- New referring domain alerts
CREATE TABLE public.backlink_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_domain TEXT NOT NULL,
  backlink_id UUID REFERENCES public.backlinks(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL DEFAULT 'new_referring_domain',
  message TEXT,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_backlinks_source_domain ON public.backlinks(source_domain);
CREATE INDEX idx_backlinks_course ON public.backlinks(linked_course_id);
CREATE INDEX idx_backlinks_article ON public.backlinks(linked_article_id);
CREATE INDEX idx_outreach_status ON public.backlink_outreach(status);
CREATE INDEX idx_alerts_unack ON public.backlink_alerts(acknowledged, created_at DESC);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backlink_outreach TO authenticated;
GRANT ALL ON public.backlink_outreach TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backlinks TO authenticated;
GRANT ALL ON public.backlinks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backlink_alerts TO authenticated;
GRANT ALL ON public.backlink_alerts TO service_role;

ALTER TABLE public.backlink_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backlinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backlink_alerts ENABLE ROW LEVEL SECURITY;

-- Admin-only access (uses existing has_role function pattern)
CREATE POLICY "Admins manage backlink_outreach"
  ON public.backlink_outreach FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage backlinks"
  ON public.backlinks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage backlink_alerts"
  ON public.backlink_alerts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create alert when a new referring domain appears
CREATE OR REPLACE FUNCTION public.notify_new_referring_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO existing_count
  FROM public.backlinks
  WHERE source_domain = NEW.source_domain
    AND id <> NEW.id;

  IF existing_count = 0 THEN
    INSERT INTO public.backlink_alerts (source_domain, backlink_id, alert_type, message)
    VALUES (NEW.source_domain, NEW.id, 'new_referring_domain',
            'New referring domain detected: ' || NEW.source_domain);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_new_referring_domain
AFTER INSERT ON public.backlinks
FOR EACH ROW EXECUTE FUNCTION public.notify_new_referring_domain();

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_backlinks_updated_at BEFORE UPDATE ON public.backlinks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_outreach_updated_at BEFORE UPDATE ON public.backlink_outreach
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
