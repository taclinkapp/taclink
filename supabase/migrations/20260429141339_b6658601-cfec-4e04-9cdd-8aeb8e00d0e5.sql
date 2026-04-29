
CREATE TABLE public.ai_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'proposed',
  confidence numeric,
  risk_level text NOT NULL DEFAULT 'low',

  target_type text,
  target_id text,

  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  edited_payload jsonb,
  preview text,
  reasoning text,
  model text,

  reviewed_by uuid,
  reviewed_at timestamptz,
  executed_at timestamptz,
  error text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_actions_status_created ON public.ai_actions (status, created_at DESC);
CREATE INDEX idx_ai_actions_kind ON public.ai_actions (kind);
CREATE INDEX idx_ai_actions_target ON public.ai_actions (target_type, target_id);

ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ai_actions"
  ON public.ai_actions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Service can insert ai_actions"
  ON public.ai_actions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE TRIGGER set_ai_actions_updated_at
  BEFORE UPDATE ON public.ai_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
