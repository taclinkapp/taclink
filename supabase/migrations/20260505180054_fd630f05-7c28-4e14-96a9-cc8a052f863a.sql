ALTER TABLE public.payment_provider_settings
  ADD COLUMN IF NOT EXISTS helcim_configured boolean NOT NULL DEFAULT false;

UPDATE public.payment_provider_settings
  SET helcim_configured = true, updated_at = now()
  WHERE id = true;