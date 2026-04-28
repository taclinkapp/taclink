-- Instructor payout handles students will send the 10% deposit to
CREATE TABLE public.instructor_payout_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL,
  method_type text NOT NULL CHECK (method_type IN ('cashapp', 'venmo', 'paypal', 'zelle')),
  handle text NOT NULL,
  is_preferred boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instructor_id, method_type, handle)
);

ALTER TABLE public.instructor_payout_methods ENABLE ROW LEVEL SECURITY;

-- Instructor manages own handles
CREATE POLICY "Instructors manage their payout methods"
  ON public.instructor_payout_methods
  FOR ALL TO authenticated
  USING (auth.uid() = instructor_id)
  WITH CHECK (auth.uid() = instructor_id);

-- Admin oversight
CREATE POLICY "Admins manage all payout methods"
  ON public.instructor_payout_methods
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Students can view payout handles ONLY for an instructor they have a booking with
CREATE POLICY "Booked students can view instructor payout methods"
  ON public.instructor_payout_methods
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.courses c ON c.id = b.course_id
      WHERE b.student_id = auth.uid()
        AND c.instructor_id = instructor_payout_methods.instructor_id
    )
  );

CREATE INDEX idx_instructor_payout_methods_instructor ON public.instructor_payout_methods(instructor_id);

CREATE TRIGGER trg_payout_methods_updated_at
  BEFORE UPDATE ON public.instructor_payout_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Booking deposit tracking
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deposit_status text NOT NULL DEFAULT 'pending_send'
    CHECK (deposit_status IN ('not_required', 'pending_send', 'awaiting_confirmation', 'confirmed', 'expired')),
  ADD COLUMN IF NOT EXISTS deposit_method text
    CHECK (deposit_method IS NULL OR deposit_method IN ('cashapp', 'venmo', 'paypal', 'zelle')),
  ADD COLUMN IF NOT EXISTS deposit_handle_used text,
  ADD COLUMN IF NOT EXISTS deposit_amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_bookings_deposit_status ON public.bookings(deposit_status);