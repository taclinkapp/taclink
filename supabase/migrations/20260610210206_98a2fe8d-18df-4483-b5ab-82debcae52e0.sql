-- Dedupe test_accounts (keep oldest per user_id) then enforce uniqueness so the
-- client's single-row lookup can never return multiple rows again.
DELETE FROM public.test_accounts a
USING public.test_accounts b
WHERE a.user_id = b.user_id
  AND a.created_at > b.created_at;

-- In case of identical timestamps, keep the lowest id
DELETE FROM public.test_accounts a
USING public.test_accounts b
WHERE a.user_id = b.user_id
  AND a.id > b.id;

ALTER TABLE public.test_accounts
  ADD CONSTRAINT test_accounts_user_id_unique UNIQUE (user_id);