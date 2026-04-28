-- course_waivers: one published waiver per course
CREATE TABLE public.course_waivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Liability Waiver & Assumption of Risk',
  content text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  published boolean NOT NULL DEFAULT false,
  ai_generated boolean NOT NULL DEFAULT true,
  ai_model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_waivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Waivers viewable by published or course owner"
ON public.course_waivers FOR SELECT
USING (
  published = true
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_waivers.course_id AND c.instructor_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Instructors manage their course waivers"
ON public.course_waivers FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_waivers.course_id AND c.instructor_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_waivers.course_id AND c.instructor_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE TRIGGER course_waivers_set_updated_at
BEFORE UPDATE ON public.course_waivers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- waiver_signatures: per booking signature
CREATE TABLE public.waiver_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE,
  course_id uuid NOT NULL,
  student_id uuid NOT NULL,
  waiver_id uuid NOT NULL REFERENCES public.course_waivers(id) ON DELETE RESTRICT,
  waiver_version integer NOT NULL,
  waiver_content_snapshot text NOT NULL,
  signed_full_name text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_hint text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_waiver_signatures_course ON public.waiver_signatures(course_id);
CREATE INDEX idx_waiver_signatures_student ON public.waiver_signatures(student_id);

ALTER TABLE public.waiver_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view their own signatures"
ON public.waiver_signatures FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Instructors view signatures for their courses"
ON public.waiver_signatures FOR SELECT
USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = waiver_signatures.course_id AND c.instructor_id = auth.uid()));

CREATE POLICY "Admins view all signatures"
ON public.waiver_signatures FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students create their own signature"
ON public.waiver_signatures FOR INSERT
WITH CHECK (auth.uid() = student_id);
