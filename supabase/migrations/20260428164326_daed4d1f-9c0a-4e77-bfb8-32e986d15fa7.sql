CREATE TYPE public.booking_status AS ENUM ('reserved', 'attended', 'cancelled', 'no_show');

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status public.booking_status NOT NULL DEFAULT 'reserved',
  booked_at timestamptz NOT NULL DEFAULT now(),
  attended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);

CREATE INDEX idx_bookings_student ON public.bookings(student_id);
CREATE INDEX idx_bookings_course ON public.bookings(course_id);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can view bookings on their courses"
  ON public.bookings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = bookings.course_id AND c.instructor_id = auth.uid()
  ));

CREATE POLICY "Students can create their own bookings"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can cancel their own bookings"
  ON public.bookings FOR UPDATE TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id AND status IN ('reserved', 'cancelled'));

CREATE POLICY "Instructors can mark attendance"
  ON public.bookings FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = bookings.course_id AND c.instructor_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = bookings.course_id AND c.instructor_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all bookings"
  ON public.bookings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER bookings_set_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();