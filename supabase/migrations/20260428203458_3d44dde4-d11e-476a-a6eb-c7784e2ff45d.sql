
-- Fix mutable search_path on current_dev_user_id
CREATE OR REPLACE FUNCTION public.current_dev_user_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.headers', true)::json->>'x-dev-user-id', ''),
    ''
  );
$$;

-- Revoke direct execute from anon and authenticated on internal functions.
-- Triggers run with table owner privileges and are unaffected.
REVOKE ALL ON FUNCTION public.bump_conversation_on_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_support_ticket_on_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_new_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_review_rating_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_dev_user_id() FROM PUBLIC, anon, authenticated;
