
-- Per-course and per-instructor fee overrides
CREATE TABLE IF NOT EXISTS public.fee_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('course','instructor')),
  target_id uuid NOT NULL,
  platform_fee_cents integer,
  platform_fee_pct numeric(5,2),
  deposit_pct numeric(5,2),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, target_id)
);

ALTER TABLE public.fee_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage fee overrides"
  ON public.fee_overrides
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Anyone can read fee overrides"
  ON public.fee_overrides
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TRIGGER fee_overrides_updated_at
BEFORE UPDATE ON public.fee_overrides
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Issue report clustering
ALTER TABLE public.issue_reports
  ADD COLUMN IF NOT EXISTS cluster_id uuid,
  ADD COLUMN IF NOT EXISTS root_cause text,
  ADD COLUMN IF NOT EXISTS suggested_fix text,
  ADD COLUMN IF NOT EXISTS triaged_at timestamptz;

CREATE TABLE IF NOT EXISTS public.issue_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  root_cause text,
  suggested_fix text,
  severity text NOT NULL DEFAULT 'medium',
  report_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.issue_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage issue clusters"
  ON public.issue_clusters
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER issue_clusters_updated_at
BEFORE UPDATE ON public.issue_clusters
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
