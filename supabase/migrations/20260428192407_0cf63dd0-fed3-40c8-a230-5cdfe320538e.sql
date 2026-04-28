-- Add instructor reply columns to reviews
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS instructor_reply text,
  ADD COLUMN IF NOT EXISTS instructor_reply_at timestamp with time zone;

-- Allow instructors to update only the reply fields on reviews left for them.
-- Existing trigger prevent_review_rating_change blocks rating changes.
CREATE POLICY "Instructors can reply to their reviews"
ON public.reviews
FOR UPDATE
TO authenticated
USING (auth.uid() = instructor_id)
WITH CHECK (auth.uid() = instructor_id);