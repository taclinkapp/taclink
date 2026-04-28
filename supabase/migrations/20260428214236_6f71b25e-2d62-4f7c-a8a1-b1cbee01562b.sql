-- Punch card system: paid subscribers earn 1 free listing-fee credit per 5 attended courses.

CREATE TABLE public.instructor_punches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  course_id uuid NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);
CREATE INDEX idx_instructor_punches_instructor ON public.instructor_punches(instructor_id);

ALTER TABLE public.instructor_punches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors view their punches"
  ON public.instructor_punches FOR SELECT TO authenticated
  USING (auth.uid() = instructor_id);

CREATE POLICY "Instructors insert their punches"
  ON public.instructor_punches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = instructor_id);

CREATE POLICY "Admins manage all punches"
  ON public.instructor_punches FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.instructor_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL,
  credit_type text NOT NULL DEFAULT 'free_listing_fee',
  earned_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  redeemed_course_id uuid,
  source text NOT NULL DEFAULT 'punch_card',
  note text
);
CREATE INDEX idx_instructor_credits_instructor ON public.instructor_credits(instructor_id);
CREATE INDEX idx_instructor_credits_unredeemed ON public.instructor_credits(instructor_id) WHERE redeemed_at IS NULL;

ALTER TABLE public.instructor_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors view their credits"
  ON public.instructor_credits FOR SELECT TO authenticated
  USING (auth.uid() = instructor_id);

CREATE POLICY "Instructors insert their credits"
  ON public.instructor_credits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = instructor_id);

CREATE POLICY "Instructors update their own credits (redeem)"
  ON public.instructor_credits FOR UPDATE TO authenticated
  USING (auth.uid() = instructor_id)
  WITH CHECK (auth.uid() = instructor_id);

CREATE POLICY "Admins manage all credits"
  ON public.instructor_credits FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger: on booking flipped to 'attended', if instructor is subscribed,
-- record a punch and (every 5th punch) issue a free-listing-fee credit.
CREATE OR REPLACE FUNCTION public.award_punch_on_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instructor uuid;
  v_sub_status text;
  v_punch_count integer;
BEGIN
  IF NEW.status <> 'attended' OR (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  SELECT c.instructor_id INTO v_instructor
    FROM public.courses c WHERE c.id = NEW.course_id;
  IF v_instructor IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT subscription_status INTO v_sub_status
    FROM public.profiles WHERE id = v_instructor;
  IF v_sub_status IS DISTINCT FROM 'active' THEN
    RETURN NEW; -- punch card is paid-subscriber only
  END IF;

  INSERT INTO public.instructor_punches (instructor_id, booking_id, course_id)
  VALUES (v_instructor, NEW.id, NEW.course_id)
  ON CONFLICT (booking_id) DO NOTHING;

  SELECT COUNT(*) INTO v_punch_count
    FROM public.instructor_punches WHERE instructor_id = v_instructor;

  IF v_punch_count > 0 AND v_punch_count % 5 = 0 THEN
    INSERT INTO public.instructor_credits (instructor_id, credit_type, source, note)
    VALUES (v_instructor, 'free_listing_fee', 'punch_card',
            'Earned at ' || v_punch_count || ' completed courses');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER award_punch_on_attendance_trg
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.award_punch_on_attendance();

-- Default subscription_status to 'free' going forward (was 'inactive')
ALTER TABLE public.profiles ALTER COLUMN subscription_status SET DEFAULT 'free';
UPDATE public.profiles SET subscription_status = 'free' WHERE subscription_status = 'inactive';