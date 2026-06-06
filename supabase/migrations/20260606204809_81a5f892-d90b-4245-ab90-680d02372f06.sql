-- Fix 1: Drop unused plaintext access_pin column from influencer_links
ALTER TABLE public.influencer_links DROP COLUMN IF EXISTS access_pin;

-- Fix 2: Tighten realtime.messages policy to only allow notif-{uid} topics
DROP POLICY IF EXISTS "Users can subscribe to their own notification channel" ON realtime.messages;

CREATE POLICY "Users can subscribe to their own notification channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'notif-' || auth.uid()::text
);