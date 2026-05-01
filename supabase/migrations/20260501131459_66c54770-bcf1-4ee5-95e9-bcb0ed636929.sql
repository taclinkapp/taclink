-- Track fake test accounts created by admins for repeatable onboarding testing.
CREATE TABLE IF NOT EXISTS public.test_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  password text NOT NULL,
  role text NOT NULL CHECK (role IN ('instructor','student')),
  label text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.test_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage test accounts"
  ON public.test_accounts
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_test_accounts_role ON public.test_accounts(role);
CREATE INDEX IF NOT EXISTS idx_test_accounts_created_at ON public.test_accounts(created_at DESC);