CREATE TABLE IF NOT EXISTS public.proximity_token_nonces (
  nonce text PRIMARY KEY,
  booking_id uuid NOT NULL,
  student_id uuid NOT NULL,
  device_id text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_by_instructor uuid
);

CREATE INDEX IF NOT EXISTS idx_prox_nonces_booking ON public.proximity_token_nonces(booking_id);
CREATE INDEX IF NOT EXISTS idx_prox_nonces_expires ON public.proximity_token_nonces(expires_at);

ALTER TABLE public.proximity_token_nonces ENABLE ROW LEVEL SECURITY;

-- No user-facing policies: only the service role (edge function) touches this table.
-- Admins can inspect for debugging.
CREATE POLICY "Admins read nonces"
  ON public.proximity_token_nonces
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));