-- Auto-approval trust settings (single row)
CREATE TABLE IF NOT EXISTS public.ai_auto_approve_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- Per-kind config: { kind: { enabled: bool, max_risk: 'low'|'medium', min_confidence: 0..1 } }
  rules jsonb NOT NULL DEFAULT '{
    "message_reply": {"enabled": true, "max_risk": "low", "min_confidence": 0.85},
    "review_moderation": {"enabled": true, "max_risk": "low", "min_confidence": 0.85},
    "instructor_nudge": {"enabled": false, "max_risk": "low", "min_confidence": 0.8},
    "credential_verify": {"enabled": false, "max_risk": "low", "min_confidence": 0.9},
    "course_moderation": {"enabled": false, "max_risk": "low", "min_confidence": 0.9},
    "support_reply": {"enabled": false, "max_risk": "low", "min_confidence": 0.9},
    "refund_recommendation": {"enabled": false, "max_risk": "low", "min_confidence": 0.95}
  }'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.ai_auto_approve_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.ai_auto_approve_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage auto-approve settings"
  ON public.ai_auto_approve_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Service can read auto-approve settings"
  ON public.ai_auto_approve_settings
  FOR SELECT TO anon, authenticated
  USING (true);

-- Track that an action was auto-approved
ALTER TABLE public.ai_actions
  ADD COLUMN IF NOT EXISTS auto_approved boolean NOT NULL DEFAULT false;

-- Weekly CEO Brief storage
CREATE TABLE IF NOT EXISTS public.cockpit_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_starting date NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  -- Structured snapshot used to render the brief
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- AI-generated narrative + action items
  summary text,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  emailed_at timestamptz,
  UNIQUE (week_starting)
);

ALTER TABLE public.cockpit_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read briefs"
  ON public.cockpit_briefs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Service inserts briefs"
  ON public.cockpit_briefs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Service updates briefs"
  ON public.cockpit_briefs FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_cockpit_briefs_week ON public.cockpit_briefs (week_starting DESC);

CREATE TRIGGER set_ai_auto_approve_updated_at
  BEFORE UPDATE ON public.ai_auto_approve_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();