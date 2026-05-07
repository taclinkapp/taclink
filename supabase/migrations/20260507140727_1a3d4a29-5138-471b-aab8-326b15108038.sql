CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phone_verifications_phone_idx ON public.phone_verifications (phone, created_at DESC);

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

-- No policies => only service role (edge functions) can access.
