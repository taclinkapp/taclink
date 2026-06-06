
-- Restrict realtime broadcast topic subscriptions for notifications and conversations.
-- Postgres-changes streams still respect table RLS, but we additionally lock down topic-name patterns.

DO $$
BEGIN
  -- Drop any prior versions of these policies if re-running
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='realtime' AND tablename='messages' AND policyname='Users can subscribe to their own notification channel') THEN
    DROP POLICY "Users can subscribe to their own notification channel" ON realtime.messages;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='realtime' AND tablename='messages' AND policyname='Authenticated users can subscribe to scoped app channels') THEN
    DROP POLICY "Authenticated users can subscribe to scoped app channels" ON realtime.messages;
  END IF;
END $$;

-- A user may only listen on notif-<their uuid>
CREATE POLICY "Users can subscribe to their own notification channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE 'notif-%' AND realtime.topic() = 'notif-' || auth.uid()::text)
  OR realtime.topic() NOT LIKE 'notif-%'
);
