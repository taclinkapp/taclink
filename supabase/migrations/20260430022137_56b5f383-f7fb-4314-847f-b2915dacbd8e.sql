-- 1. Allow new escrow deposit_status values
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_deposit_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_deposit_status_check
  CHECK (deposit_status = ANY (ARRAY[
    'not_required'::text,
    'pending_payment'::text,
    'held_in_escrow'::text,
    'released'::text,
    'refunded'::text,
    -- legacy values kept so historical rows remain valid
    'pending_send'::text,
    'awaiting_confirmation'::text,
    'confirmed'::text,
    'expired'::text
  ]));

-- 2. Stripe session tracking
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text;

CREATE INDEX IF NOT EXISTS idx_bookings_stripe_session ON public.bookings(stripe_checkout_session_id);

-- 3. Instructor Stripe Connect fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_status text NOT NULL DEFAULT 'not_started';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_stripe_connect_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_stripe_connect_status_check
  CHECK (stripe_connect_status = ANY (ARRAY['not_started','onboarding','active','restricted']));

-- 4. Hard-cancel in-flight legacy direct-handoff bookings (cutover)
UPDATE public.bookings
SET status = 'cancelled',
    deposit_status = 'expired',
    updated_at = now()
WHERE status = 'reserved'
  AND deposit_status IN ('pending_send', 'awaiting_confirmation');

-- 5. Cron: release escrow 24h after the course ends
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;