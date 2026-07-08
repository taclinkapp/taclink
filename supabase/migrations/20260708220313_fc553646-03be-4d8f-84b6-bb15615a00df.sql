-- 1) checkin_manual_codes: add explicit admin SELECT policy (edge functions use service_role)
CREATE POLICY "Admins can read checkin manual codes"
  ON public.checkin_manual_codes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) conversations: remove from realtime publication to stop postgres_changes PII leak
ALTER PUBLICATION supabase_realtime DROP TABLE public.conversations;

-- 3) email_unsubscribe_tokens: add admin SELECT + DELETE policies for cleanup
CREATE POLICY "Admins can read unsubscribe tokens"
  ON public.email_unsubscribe_tokens FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete unsubscribe tokens"
  ON public.email_unsubscribe_tokens FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can delete unsubscribe tokens"
  ON public.email_unsubscribe_tokens FOR DELETE
  USING (auth.role() = 'service_role');

-- Rotate any low-entropy tokens (<40 chars) to 64 hex chars
UPDATE public.email_unsubscribe_tokens
   SET token = encode(gen_random_bytes(32), 'hex')
 WHERE length(token) < 40;

-- 4) influencer_links: hide access_pin from owners via column-level revoke.
-- Service role (edge functions / admin API) retains full column access.
REVOKE SELECT (access_pin) ON public.influencer_links FROM authenticated;
REVOKE SELECT (access_pin) ON public.influencer_links FROM anon;
GRANT SELECT (access_pin) ON public.influencer_links TO service_role;