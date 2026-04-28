CREATE TABLE public.issue_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_name TEXT,
  reporter_email TEXT,
  reporter_role TEXT,
  page_url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'bug',
  severity TEXT NOT NULL DEFAULT 'medium',
  description TEXT NOT NULL,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.issue_reports ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including anonymous pre-launch users) to file a report
CREATE POLICY "Anyone can submit an issue report"
  ON public.issue_reports
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- For now, allow read/update from anywhere so the existing mock-admin panel works.
-- Once real admin auth is wired in, tighten this with a has_role() check.
CREATE POLICY "Public can read issue reports (pre-launch admin)"
  ON public.issue_reports
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can update issue reports (pre-launch admin)"
  ON public.issue_reports
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_issue_reports_status ON public.issue_reports(status);
CREATE INDEX idx_issue_reports_created_at ON public.issue_reports(created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_issue_reports_updated_at
  BEFORE UPDATE ON public.issue_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();