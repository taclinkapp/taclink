
-- Web Push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subs - select"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own push subs - insert"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own push subs - delete"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own push subs - update"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger: when a notification row is inserted, fan out to send-web-push
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_web_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn_url TEXT := 'https://jocnlpkbaqmriedmbocl.supabase.co/functions/v1/send-web-push';
  service_key TEXT;
BEGIN
  -- Best-effort; never block the insert.
  BEGIN
    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object(
        'notification_id', NEW.id,
        'recipient_id',   NEW.recipient_id,
        'title',          NEW.title,
        'body',           NEW.body,
        'link',           NEW.link,
        'type',           NEW.type
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- swallow; in-app notification still works
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_web_push ON public.notifications;
CREATE TRIGGER trg_notifications_web_push
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notify_web_push();
