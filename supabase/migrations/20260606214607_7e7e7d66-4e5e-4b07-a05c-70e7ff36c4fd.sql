
-- 1) backup_payment_rails: remove credentials column, add credential_keys reference list
ALTER TABLE public.backup_payment_rails DROP COLUMN IF EXISTS credentials;
ALTER TABLE public.backup_payment_rails ADD COLUMN IF NOT EXISTS credential_keys text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.backup_payment_rails.credential_keys IS
  'Names of secrets stored in Lovable Cloud Secrets that edge functions must read at runtime. Do NOT store secret values in this table.';

-- 2) profiles_public view — drop & recreate with only safe columns
DROP VIEW IF EXISTS public.profiles_public CASCADE;

CREATE VIEW public.profiles_public
WITH (security_invoker = off) AS
SELECT
  id,
  display_name,
  photo_url,
  bio,
  state,
  service_categories
FROM public.profiles;

REVOKE ALL ON public.profiles_public FROM PUBLIC;
GRANT SELECT ON public.profiles_public TO anon, authenticated;

COMMENT ON VIEW public.profiles_public IS
  'Safe, column-restricted projection of public.profiles for cross-user reads. Never expose phone, stripe_connect_account_id, disabled_reason, strike_points, or account_status here.';

-- 3) Realtime topic restrictions
DROP POLICY IF EXISTS "inbox topic owner only" ON realtime.messages;
CREATE POLICY "inbox topic owner only"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE 'inbox-%')
  AND (realtime.topic() = 'inbox-' || auth.uid()::text)
);

DROP POLICY IF EXISTS "notif topic owner only" ON realtime.messages;
CREATE POLICY "notif topic owner only"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE 'notif-%')
  AND (realtime.topic() = 'notif-' || auth.uid()::text)
);
