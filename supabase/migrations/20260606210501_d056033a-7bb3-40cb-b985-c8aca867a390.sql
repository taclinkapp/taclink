CREATE POLICY "Students view their own checkin attempts"
ON public.checkin_attempts
FOR SELECT
TO authenticated
USING (auth.uid() = student_id);