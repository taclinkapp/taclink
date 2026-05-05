CREATE TABLE IF NOT EXISTS public.helcim_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  checkout_token text NOT NULL UNIQUE,
  secret_token text NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'initialized' CHECK (status IN ('initialized', 'confirmed', 'failed')),
  helcim_transaction_id text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

CREATE INDEX IF NOT EXISTS helcim_checkout_sessions_booking_id_idx
  ON public.helcim_checkout_sessions (booking_id, created_at DESC);

ALTER TABLE public.helcim_checkout_sessions ENABLE ROW LEVEL SECURITY;