-- Refunds: admin-managed payouts back to students for the platform fee or deposit.
CREATE TABLE public.refunds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  student_id UUID NOT NULL,
  issued_by UUID NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  refund_type TEXT NOT NULL CHECK (refund_type IN ('platform_fee', 'deposit', 'full', 'other')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'failed', 'reversed')),
  external_reference TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_refunds_booking ON public.refunds(booking_id);
CREATE INDEX idx_refunds_student ON public.refunds(student_id);
CREATE INDEX idx_refunds_created ON public.refunds(created_at DESC);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all refunds"
  ON public.refunds
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Students view their own refunds"
  ON public.refunds
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Instructors view refunds on their courses"
  ON public.refunds
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.courses c ON c.id = b.course_id
    WHERE b.id = refunds.booking_id AND c.instructor_id = auth.uid()
  ));

CREATE TRIGGER refunds_set_updated_at
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();