
CREATE TABLE IF NOT EXISTS public.instructor_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL,
  course_id uuid NOT NULL,
  charge_type text NOT NULL DEFAULT 'listing_fee',
  course_price_cents integer NOT NULL,
  capacity integer NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'charged',
  refundable boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instructor_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors view their own charges"
  ON public.instructor_charges FOR SELECT TO authenticated
  USING (auth.uid() = instructor_id);

CREATE POLICY "Instructors create their own charges"
  ON public.instructor_charges FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = instructor_id);

CREATE POLICY "Admins manage all instructor charges"
  ON public.instructor_charges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_instructor_charges_instructor ON public.instructor_charges(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_charges_course ON public.instructor_charges(course_id);
