-- Attendance claims (instructor proves attendance when scan was missed)
CREATE TABLE public.attendance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  course_id uuid NOT NULL,
  instructor_id uuid NOT NULL,
  student_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','denied','auto_approved','admin_review')),
  instructor_note text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  student_responded_at timestamptz,
  student_response_note text,
  auto_approve_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  ai_confidence numeric,
  ai_decision text,
  ai_reasoning text,
  resolved_at timestamptz,
  reminder_count int NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);

CREATE INDEX idx_attendance_claims_status ON public.attendance_claims(status);
CREATE INDEX idx_attendance_claims_auto_approve ON public.attendance_claims(auto_approve_at) WHERE status = 'pending';
CREATE INDEX idx_attendance_claims_student ON public.attendance_claims(student_id);

ALTER TABLE public.attendance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors file claims for their courses"
  ON public.attendance_claims FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = instructor_id
    AND EXISTS (SELECT 1 FROM public.courses c
                WHERE c.id = course_id AND c.instructor_id = auth.uid())
  );

CREATE POLICY "Instructors view their claims"
  ON public.attendance_claims FOR SELECT TO authenticated
  USING (auth.uid() = instructor_id);

CREATE POLICY "Students view claims about them"
  ON public.attendance_claims FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Students respond to their claims"
  ON public.attendance_claims FOR UPDATE TO authenticated
  USING (auth.uid() = student_id AND status = 'pending')
  WITH CHECK (auth.uid() = student_id AND status IN ('confirmed','denied'));

CREATE POLICY "Admins manage claims"
  ON public.attendance_claims FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_attendance_claims_updated
  BEFORE UPDATE ON public.attendance_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- When claim is confirmed or auto-approved, mark booking attended + set release window
CREATE OR REPLACE FUNCTION public.apply_attendance_claim_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ends timestamptz;
BEGIN
  IF NEW.status IN ('confirmed','auto_approved')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT COALESCE(c.ends_at, c.starts_at) INTO v_ends
      FROM public.courses c WHERE c.id = NEW.course_id;
    UPDATE public.bookings
       SET status = 'attended'::booking_status,
           attended_at = COALESCE(attended_at, now()),
           release_eligible_at = COALESCE(release_eligible_at, COALESCE(v_ends, now()) + interval '24 hours'),
           updated_at = now()
     WHERE id = NEW.booking_id
       AND escrow_status IN ('held','pending');
    NEW.resolved_at := COALESCE(NEW.resolved_at, now());
  ELSIF NEW.status = 'denied' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.resolved_at := COALESCE(NEW.resolved_at, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_attendance_claim
  BEFORE UPDATE ON public.attendance_claims
  FOR EACH ROW EXECUTE FUNCTION public.apply_attendance_claim_resolution();

-- Proximity events log
CREATE TABLE public.proximity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  course_id uuid NOT NULL,
  student_id uuid NOT NULL,
  distance_m numeric,
  accuracy_m numeric,
  smoothed_m numeric,
  source text NOT NULL DEFAULT 'gps' CHECK (source IN ('gps','handshake','ble')),
  verified boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proximity_events_booking ON public.proximity_events(booking_id);
CREATE INDEX idx_proximity_events_course ON public.proximity_events(course_id);

ALTER TABLE public.proximity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students log their own proximity"
  ON public.proximity_events FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (SELECT 1 FROM public.bookings b
                WHERE b.id = booking_id AND b.student_id = auth.uid())
  );

CREATE POLICY "Students view their own proximity"
  ON public.proximity_events FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Instructors view proximity for their courses"
  ON public.proximity_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c
                 WHERE c.id = course_id AND c.instructor_id = auth.uid()));

CREATE POLICY "Admins view all proximity"
  ON public.proximity_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Helper: list claims due for auto-approval (called by cron)
CREATE OR REPLACE FUNCTION public.list_due_attendance_claims()
RETURNS TABLE(claim_id uuid, booking_id uuid, student_id uuid, instructor_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, booking_id, student_id, instructor_id
    FROM public.attendance_claims
   WHERE status = 'pending'
     AND auto_approve_at <= now();
$$;