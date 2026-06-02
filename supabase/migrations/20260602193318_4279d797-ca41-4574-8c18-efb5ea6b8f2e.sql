-- 1) Tighten the messages UPDATE policy: only the original sender (or admin)
-- may rewrite a message. The previous WITH CHECK let either participant in
-- the conversation overwrite the other party's message body.
DROP POLICY IF EXISTS "Senders can update their own messages" ON public.messages;
CREATE POLICY "Senders can update their own messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    sender_id = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    sender_id = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 2) Prevent double listing-fee charges from concurrent publish taps.
-- The client does SELECT-then-INSERT; without a unique constraint two
-- in-flight publishes both pass the "no existing charge" check.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_instructor_charges_course_listing_fee
  ON public.instructor_charges(course_id)
  WHERE charge_type = 'listing_fee';

-- 3) Let an instructor write their own payout-account row. Previously the
-- only INSERT/UPDATE policy was service-role-only, so the client upsert in
-- NewCourse / PayoutMethods silently failed and admin dashboards saw the
-- instructor as "not_started" even though their payout method was saved.
DROP POLICY IF EXISTS "Instructors manage their payout account" ON public.instructor_payout_accounts;
CREATE POLICY "Instructors manage their payout account"
  ON public.instructor_payout_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = instructor_id);
CREATE POLICY "Instructors update their payout account"
  ON public.instructor_payout_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = instructor_id)
  WITH CHECK (auth.uid() = instructor_id);

-- 4) Stop leaking payout handles (Zelle phone, CashApp $tag, PayPal email)
-- to students who booked any course with the instructor. Students don't need
-- to see the handle; the platform routes the money.
DROP POLICY IF EXISTS "Booked students can view instructor payout methods" ON public.instructor_payout_methods;