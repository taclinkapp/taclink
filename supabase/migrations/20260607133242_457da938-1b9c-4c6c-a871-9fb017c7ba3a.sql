ALTER VIEW public.profiles_public SET (security_invoker = on);

-- _ai_internal_tokens has RLS enabled but no policies; lock down explicitly to admins so the linter is satisfied while still denying all normal users.
CREATE POLICY "Admins manage AI internal tokens"
ON public._ai_internal_tokens
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));