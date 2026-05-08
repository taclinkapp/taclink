ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_reason text,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;