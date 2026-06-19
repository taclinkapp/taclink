CREATE TABLE public.checkin_manual_codes (
  booking_id uuid PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  code_hash text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checkin_manual_codes_course_code_unique UNIQUE (course_id, code_hash)
);

GRANT ALL ON public.checkin_manual_codes TO service_role;

ALTER TABLE public.checkin_manual_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_checkin_manual_codes_course_hash ON public.checkin_manual_codes(course_id, code_hash);
CREATE INDEX idx_checkin_manual_codes_expires_at ON public.checkin_manual_codes(expires_at);

CREATE TRIGGER checkin_manual_codes_set_updated_at
  BEFORE UPDATE ON public.checkin_manual_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();