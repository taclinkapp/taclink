CREATE TABLE IF NOT EXISTS public.helcim_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  payload jsonb NOT NULL,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received','processing','succeeded','failed','retrying')),
  last_error text,
  attempt_count integer NOT NULL DEFAULT 0,
  helcim_transaction_id text,
  booking_id uuid,
  last_attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_helcim_webhook_events_txn ON public.helcim_webhook_events (helcim_transaction_id);
CREATE INDEX IF NOT EXISTS idx_helcim_webhook_events_booking ON public.helcim_webhook_events (booking_id);
CREATE INDEX IF NOT EXISTS idx_helcim_webhook_events_status ON public.helcim_webhook_events (processing_status, created_at DESC);

ALTER TABLE public.helcim_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read helcim webhook events"
  ON public.helcim_webhook_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update helcim webhook events"
  ON public.helcim_webhook_events FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages helcim webhook events"
  ON public.helcim_webhook_events FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.set_helcim_webhook_events_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_helcim_webhook_events_updated_at
  BEFORE UPDATE ON public.helcim_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.set_helcim_webhook_events_updated_at();