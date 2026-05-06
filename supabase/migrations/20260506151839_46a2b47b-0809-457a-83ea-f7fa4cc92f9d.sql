
CREATE TABLE public.uptime_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  url text NOT NULL,
  interval_minutes integer NOT NULL DEFAULT 5,
  expected_status integer NOT NULL DEFAULT 200,
  active boolean NOT NULL DEFAULT true,
  alert_emails text[] NOT NULL DEFAULT '{}',
  consecutive_failures integer NOT NULL DEFAULT 0,
  alert_threshold integer NOT NULL DEFAULT 2,
  last_status text,
  last_checked_at timestamptz,
  last_error text,
  last_alert_sent_at timestamptz
);

CREATE TABLE public.uptime_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id uuid NOT NULL REFERENCES public.uptime_monitors(id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL, -- 'up' | 'down' | 'degraded'
  http_status integer,
  response_ms integer,
  ssl_days_remaining integer,
  error text
);
CREATE INDEX idx_uptime_checks_monitor_time ON public.uptime_checks (monitor_id, checked_at DESC);

CREATE TABLE public.domain_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  last_checked_at timestamptz,
  https_ok boolean,
  http_status integer,
  ssl_valid boolean,
  ssl_expires_at timestamptz,
  ssl_days_remaining integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.uptime_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uptime_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage monitors" ON public.uptime_monitors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins read checks" ON public.uptime_checks
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role inserts checks" ON public.uptime_checks
  FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins read domain status" ON public.domain_status
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages domain status" ON public.domain_status
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_uptime_monitors_updated
  BEFORE UPDATE ON public.uptime_monitors
  FOR EACH ROW EXECUTE FUNCTION public.tg_refund_test_runs_touch();
CREATE TRIGGER trg_domain_status_updated
  BEFORE UPDATE ON public.domain_status
  FOR EACH ROW EXECUTE FUNCTION public.tg_refund_test_runs_touch();

INSERT INTO public.uptime_monitors (name, url, interval_minutes, expected_status)
VALUES
  ('Marketing site (apex)', 'https://taclink.app', 5, 200),
  ('Marketing site (www)', 'https://www.taclink.app', 5, 200),
  ('Sign-in page', 'https://taclink.app/auth/signin', 5, 200);

INSERT INTO public.domain_status (domain) VALUES
  ('taclink.app'), ('www.taclink.app');
