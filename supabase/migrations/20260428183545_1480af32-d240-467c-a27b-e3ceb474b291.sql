-- Admin override: allow admins to flag/unflag messages and to manage conversations
-- regardless of participant status. Booking gate is enforced application-side and
-- bypassed for admins via the bypassBookingGate flag in lib/messaging.ts.

CREATE POLICY "Admins can update any message"
ON public.messages
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Conversations already have a permissive pre-launch SELECT policy, but we add
-- an explicit admin-scoped policy so the override survives when pre-launch
-- policies are tightened later.
CREATE POLICY "Admins can read all conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update any conversation"
ON public.conversations
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
