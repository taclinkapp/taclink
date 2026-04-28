
-- Profiles: payment method + subscription tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payment_method_added boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_updated_at timestamptz;

-- Bookings: fee breakdown snapshot
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS course_price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_cents integer NOT NULL DEFAULT 2500,
  ADD COLUMN IF NOT EXISTS instructor_deposit_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_in_person_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS online_total_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS in_person_paid_at timestamptz;

-- Booking fees ledger
CREATE TABLE IF NOT EXISTS public.booking_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  course_id uuid NOT NULL,
  student_id uuid NOT NULL,
  instructor_id uuid NOT NULL,
  course_price_cents integer NOT NULL,
  platform_fee_cents integer NOT NULL,
  instructor_deposit_cents integer NOT NULL,
  due_in_person_cents integer NOT NULL,
  online_total_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view their own fee entries"
  ON public.booking_fees FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Instructors view fee entries for their courses"
  ON public.booking_fees FOR SELECT TO authenticated
  USING (auth.uid() = instructor_id);

CREATE POLICY "Admins manage all fee entries"
  ON public.booking_fees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Students create their own fee entries"
  ON public.booking_fees FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

CREATE INDEX IF NOT EXISTS idx_booking_fees_booking ON public.booking_fees(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_fees_instructor ON public.booking_fees(instructor_id);
CREATE INDEX IF NOT EXISTS idx_booking_fees_student ON public.booking_fees(student_id);

-- Keep payment_method_added in sync with payment_methods table
CREATE OR REPLACE FUNCTION public.sync_payment_method_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_has boolean;
BEGIN
  v_user := COALESCE(NEW.user_id, OLD.user_id);
  SELECT EXISTS(SELECT 1 FROM public.payment_methods WHERE user_id = v_user) INTO v_has;
  UPDATE public.profiles SET payment_method_added = v_has, updated_at = now() WHERE id = v_user;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS payment_methods_sync_flag ON public.payment_methods;
CREATE TRIGGER payment_methods_sync_flag
AFTER INSERT OR DELETE ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.sync_payment_method_flag();
