
CREATE TABLE public.refund_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_by uuid NOT NULL,
  booking_id uuid NOT NULL,
  helcim_transaction_id text,
  amount_cents integer NOT NULL DEFAULT 100,
  environment text NOT NULL DEFAULT 'live',
  status text NOT NULL DEFAULT 'running',
  refund_id uuid,
  helcim_refund_response jsonb,
  helcim_refund_txn_id text,
  before_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_snapshot jsonb,
  webhook_event_id uuid,
  webhook_received boolean NOT NULL DEFAULT false,
  webhook_signature_valid boolean,
  booking_updated boolean NOT NULL DEFAULT false,
  refund_row_updated boolean NOT NULL DEFAULT false,
  ledger_reversed boolean NOT NULL DEFAULT false,
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  completed_at timestamptz
);

CREATE INDEX idx_refund_test_runs_created ON public.refund_test_runs (created_at DESC);
CREATE INDEX idx_refund_test_runs_booking ON public.refund_test_runs (booking_id);

ALTER TABLE public.refund_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage refund test runs"
  ON public.refund_test_runs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.tg_refund_test_runs_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_refund_test_runs_updated
  BEFORE UPDATE ON public.refund_test_runs
  FOR EACH ROW EXECUTE FUNCTION public.tg_refund_test_runs_touch();
