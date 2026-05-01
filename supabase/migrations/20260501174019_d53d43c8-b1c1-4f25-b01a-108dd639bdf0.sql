ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status = ANY (ARRAY['active'::text, 'warned'::text, 'suspended'::text, 'disabled'::text]));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS disabled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS disabled_by uuid,
  ADD COLUMN IF NOT EXISTS disabled_reason text;