
-- 1) Lock down sensitive PII columns on profiles from unauthenticated (anon) reads.
-- The "Public can view instructor profiles" SELECT policy lets anon read instructor rows;
-- restrict which columns anon can actually SELECT. Authenticated callers (including owners
-- via their own policy, and admins via has_role) retain full column access.
REVOKE SELECT (phone, stripe_connect_account_id, disabled_reason, strike_points,
               payment_method_added, subscription_status, account_status)
  ON public.profiles FROM anon;

-- Defensive: also revoke from PUBLIC in case it was granted at table creation.
REVOKE SELECT (phone, stripe_connect_account_id, disabled_reason, strike_points,
               payment_method_added, subscription_status, account_status)
  ON public.profiles FROM PUBLIC;

-- 2) Tighten realtime subscribe policy: remove the broad 'messages' / 'public' topic
-- allowlist so authenticated users can only subscribe to their own user channel or
-- conversation channels they belong to.
DROP POLICY IF EXISTS "Authenticated users subscribe to own channels" ON realtime.messages;
CREATE POLICY "Authenticated users subscribe to own channels"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    (realtime.topic() = ('user:' || (auth.uid())::text))
    OR (
      (realtime.topic() LIKE 'conversation:%')
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE (c.id)::text = split_part(realtime.topic(), ':', 2)
          AND ((c.student_id = (auth.uid())::text)
            OR (c.instructor_id = (auth.uid())::text))
      )
    )
  );

-- 3) Add explicit deny-all client policy on helcim_checkout_sessions to satisfy the
-- linter (RLS already blocks all client access; service_role bypasses RLS as needed).
CREATE POLICY "No client access to helcim checkout sessions"
  ON public.helcim_checkout_sessions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
