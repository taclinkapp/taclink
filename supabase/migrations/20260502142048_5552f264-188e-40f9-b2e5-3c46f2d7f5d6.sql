-- Booking-level Helcim references (idempotent)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS helcim_checkout_token text,
  ADD COLUMN IF NOT EXISTS helcim_transaction_id text;

CREATE INDEX IF NOT EXISTS bookings_helcim_checkout_token_idx
  ON public.bookings (helcim_checkout_token)
  WHERE helcim_checkout_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_helcim_transaction_id_idx
  ON public.bookings (helcim_transaction_id)
  WHERE helcim_transaction_id IS NOT NULL;

-- Subscription-level Helcim id (for future Recurring API support)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS helcim_subscription_id text;

-- Allow authenticated users to read which provider is active. The active
-- provider name is NOT sensitive — clients need to know whether to load
-- Stripe Embedded Checkout or HelcimPay.js. Writes stay admin-only.
DROP POLICY IF EXISTS "Authenticated read active provider" ON public.payment_provider_settings;
CREATE POLICY "Authenticated read active provider"
  ON public.payment_provider_settings
  FOR SELECT
  TO authenticated
  USING (true);
