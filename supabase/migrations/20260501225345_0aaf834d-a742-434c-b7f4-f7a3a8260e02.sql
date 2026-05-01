-- =========================================================
-- Payment provider abstraction — Phase 1
-- Adds provider-agnostic tables so TacLink can swap Stripe
-- for Authorize.Net (or any other rail) without losing data.
-- Stripe stays the active provider; nothing changes today.
-- =========================================================

-- 1) Enum of supported providers
DO $$ BEGIN
  CREATE TYPE public.payment_provider AS ENUM ('stripe', 'authorize_net');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Platform-wide active provider + failover config
CREATE TABLE IF NOT EXISTS public.payment_provider_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true), -- singleton row
  active_provider public.payment_provider NOT NULL DEFAULT 'stripe',
  fallback_provider public.payment_provider,
  failover_mode text NOT NULL DEFAULT 'manual' CHECK (failover_mode IN ('manual','auto','segment')),
  authorize_net_configured boolean NOT NULL DEFAULT false,
  notes text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.payment_provider_settings (id) VALUES (true)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.payment_provider_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read provider settings" ON public.payment_provider_settings;
CREATE POLICY "Admins read provider settings"
  ON public.payment_provider_settings FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins update provider settings" ON public.payment_provider_settings;
CREATE POLICY "Admins update provider settings"
  ON public.payment_provider_settings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Provider-agnostic instructor payout accounts.
-- Today: one row per instructor with provider='stripe' mirroring profiles.stripe_connect_account_id.
-- Tomorrow: a second row per instructor with provider='authorize_net' for the backup rail.
CREATE TABLE IF NOT EXISTS public.instructor_payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider public.payment_provider NOT NULL,
  external_account_id text,           -- Stripe Connect acct_xxx OR Authorize.Net customerProfileId
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','onboarding','active','restricted','disabled')),
  payouts_enabled boolean NOT NULL DEFAULT false,
  charges_enabled boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instructor_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_payout_accounts_instructor ON public.instructor_payout_accounts(instructor_id);
CREATE INDEX IF NOT EXISTS idx_payout_accounts_provider ON public.instructor_payout_accounts(provider, status);

ALTER TABLE public.instructor_payout_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors read their payout accounts" ON public.instructor_payout_accounts;
CREATE POLICY "Instructors read their payout accounts"
  ON public.instructor_payout_accounts FOR SELECT
  USING (auth.uid() = instructor_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Service role manages payout accounts" ON public.instructor_payout_accounts;
CREATE POLICY "Service role manages payout accounts"
  ON public.instructor_payout_accounts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS touch_payout_accounts ON public.instructor_payout_accounts;
CREATE TRIGGER touch_payout_accounts
  BEFORE UPDATE ON public.instructor_payout_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Backfill from existing Stripe Connect data so the new table mirrors today's reality.
INSERT INTO public.instructor_payout_accounts
  (instructor_id, provider, external_account_id, status, payouts_enabled, charges_enabled)
SELECT p.id, 'stripe', p.stripe_connect_account_id,
       COALESCE(p.stripe_connect_status, 'pending'),
       COALESCE(p.stripe_connect_status, '') = 'active',
       COALESCE(p.stripe_connect_status, '') = 'active'
  FROM public.profiles p
 WHERE p.stripe_connect_account_id IS NOT NULL
ON CONFLICT (instructor_id, provider) DO NOTHING;

-- 4) Instructor ledger — needed when the active provider does NOT support
-- native marketplace splits (Authorize.Net). Each booking that gets charged
-- writes an "owed" entry; the weekly payout job writes "paid" entries.
-- For Stripe today this table stays empty; Stripe Connect handles splits natively.
CREATE TABLE IF NOT EXISTS public.instructor_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  provider public.payment_provider NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('owed','paid','reversed','adjustment')),
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  external_payout_id text,            -- ACH transfer id, etc.
  available_at timestamptz,           -- when 'owed' becomes payable (24h after course)
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_instructor ON public.instructor_ledger(instructor_id, entry_type);
CREATE INDEX IF NOT EXISTS idx_ledger_booking ON public.instructor_ledger(booking_id);
CREATE INDEX IF NOT EXISTS idx_ledger_payable ON public.instructor_ledger(available_at)
  WHERE entry_type = 'owed' AND paid_at IS NULL;

ALTER TABLE public.instructor_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors read their ledger" ON public.instructor_ledger;
CREATE POLICY "Instructors read their ledger"
  ON public.instructor_ledger FOR SELECT
  USING (auth.uid() = instructor_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Service role manages ledger" ON public.instructor_ledger;
CREATE POLICY "Service role manages ledger"
  ON public.instructor_ledger FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5) Tag bookings + subscriptions with the provider that processed them,
-- so future failover queries can tell what's on which rail.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_provider public.payment_provider NOT NULL DEFAULT 'stripe';
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider public.payment_provider NOT NULL DEFAULT 'stripe';

-- 6) Helper: read the active provider (used by edge functions + RLS-safe RPC).
CREATE OR REPLACE FUNCTION public.get_active_payment_provider()
RETURNS public.payment_provider
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT active_provider FROM public.payment_provider_settings WHERE id = true;
$$;

-- 7) Helper: instructor's outstanding (owed-but-unpaid) balance on a given provider.
CREATE OR REPLACE FUNCTION public.instructor_owed_balance_cents(_instructor_id uuid, _provider public.payment_provider)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE entry_type
      WHEN 'owed' THEN amount_cents
      WHEN 'reversed' THEN -amount_cents
      WHEN 'adjustment' THEN amount_cents
      WHEN 'paid' THEN -amount_cents
      ELSE 0
    END
  ), 0)::integer
  FROM public.instructor_ledger
  WHERE instructor_id = _instructor_id
    AND provider = _provider;
$$;