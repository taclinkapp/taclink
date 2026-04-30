
-- ============ NOTIFICATIONS ============
DROP POLICY IF EXISTS "Recipients can read their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Recipients can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications (server-driven)" ON public.notifications;

CREATE POLICY "Recipients can read their notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Recipients can update their notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (recipient_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ CONVERSATIONS ============
DROP POLICY IF EXISTS "Public can read conversations (pre-launch)" ON public.conversations;
DROP POLICY IF EXISTS "Public can update conversations (pre-launch)" ON public.conversations;
DROP POLICY IF EXISTS "Public can insert conversations (pre-launch)" ON public.conversations;

CREATE POLICY "Participants can read conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()::text
    OR instructor_id = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Participants can update their conversation metadata"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()::text
    OR instructor_id = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    student_id = auth.uid()::text
    OR instructor_id = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Participants can create their conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()::text
    OR instructor_id = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ============ MESSAGES ============
DROP POLICY IF EXISTS "Participants can read messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can update messages" ON public.messages;

CREATE POLICY "Participants can read messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.student_id = auth.uid()::text
          OR c.instructor_id = auth.uid()::text
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
    )
  );

CREATE POLICY "Senders can update their own messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    sender_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.student_id = auth.uid()::text OR c.instructor_id = auth.uid()::text)
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    sender_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.student_id = auth.uid()::text OR c.instructor_id = auth.uid()::text)
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ============ ISSUE REPORTS ============
DROP POLICY IF EXISTS "Public can read issue reports (pre-launch admin)" ON public.issue_reports;
DROP POLICY IF EXISTS "Public can update issue reports (pre-launch admin)" ON public.issue_reports;

CREATE POLICY "Submitters and admins can read issue reports"
  ON public.issue_reports FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (auth.uid() IS NOT NULL AND reporter_email = (auth.jwt() ->> 'email'))
  );

CREATE POLICY "Admins can update issue reports"
  ON public.issue_reports FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ FEEDBACK SUBMISSIONS ============
DROP POLICY IF EXISTS "Public can read feedback (pre-launch admin)" ON public.feedback_submissions;
DROP POLICY IF EXISTS "Public can update feedback (pre-launch admin)" ON public.feedback_submissions;

CREATE POLICY "Submitters and admins can read feedback"
  ON public.feedback_submissions FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (auth.uid() IS NOT NULL AND submitter_email = (auth.jwt() ->> 'email'))
  );

CREATE POLICY "Admins can update feedback"
  ON public.feedback_submissions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ AI AUTO-APPROVE SETTINGS ============
DROP POLICY IF EXISTS "Service can read auto-approve settings" ON public.ai_auto_approve_settings;

CREATE POLICY "Admins can read auto-approve settings"
  ON public.ai_auto_approve_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ FEE OVERRIDES ============
DROP POLICY IF EXISTS "Anyone can read fee overrides" ON public.fee_overrides;

CREATE POLICY "Admins and targeted instructors can read fee overrides"
  ON public.fee_overrides FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (scope = 'instructor' AND target_id = auth.uid())
  );
