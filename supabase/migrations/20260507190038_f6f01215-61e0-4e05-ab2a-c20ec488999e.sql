-- 1. Pillar enum
DO $$ BEGIN
  CREATE TYPE public.skill_pillar AS ENUM (
    'firearms','combatives','protective_ops','fieldcraft','medical','tactics'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Add pillar columns to courses
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS primary_pillar public.skill_pillar,
  ADD COLUMN IF NOT EXISTS secondary_pillar public.skill_pillar;

-- 3. XP awards ledger (one row per booking, idempotent via unique key)
CREATE TABLE IF NOT EXISTS public.student_xp_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  booking_id UUID NOT NULL,
  course_id UUID NOT NULL,
  pillar public.skill_pillar NOT NULL,
  xp INTEGER NOT NULL,
  base_xp INTEGER NOT NULL DEFAULT 50,
  bonus_first_mission INTEGER NOT NULL DEFAULT 0,
  bonus_full_day INTEGER NOT NULL DEFAULT 0,
  bonus_multi_day INTEGER NOT NULL DEFAULT 0,
  bonus_five_star INTEGER NOT NULL DEFAULT 0,
  is_secondary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, pillar)
);

CREATE INDEX IF NOT EXISTS idx_student_xp_awards_student ON public.student_xp_awards(student_id);
CREATE INDEX IF NOT EXISTS idx_student_xp_awards_pillar ON public.student_xp_awards(student_id, pillar);

ALTER TABLE public.student_xp_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view their own xp"
  ON public.student_xp_awards FOR SELECT
  USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Instructors view xp for their courses"
  ON public.student_xp_awards FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = auth.uid()));

CREATE TRIGGER trg_student_xp_awards_updated_at
  BEFORE UPDATE ON public.student_xp_awards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Award function: called from bookings trigger
CREATE OR REPLACE FUNCTION public.award_pillar_xp_for_booking(_booking_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b RECORD;
  v_c RECORD;
  v_duration_hours NUMERIC;
  v_first_mission_bonus INT := 0;
  v_full_day_bonus INT := 0;
  v_multi_day_bonus INT := 0;
  v_prior_count INT;
  v_pillar public.skill_pillar;
  v_total INT;
BEGIN
  SELECT b.id, b.student_id, b.course_id INTO v_b
  FROM public.bookings b WHERE b.id = _booking_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT c.id, c.starts_at, c.ends_at, c.primary_pillar, c.secondary_pillar
    INTO v_c FROM public.courses c WHERE c.id = v_b.course_id;
  IF NOT FOUND OR v_c.primary_pillar IS NULL THEN RETURN; END IF;

  IF v_c.starts_at IS NOT NULL AND v_c.ends_at IS NOT NULL THEN
    v_duration_hours := EXTRACT(EPOCH FROM (v_c.ends_at - v_c.starts_at)) / 3600.0;
    IF v_duration_hours > 24 THEN v_multi_day_bonus := 50;
    ELSIF v_duration_hours > 8 THEN v_full_day_bonus := 25;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_prior_count
    FROM public.student_xp_awards WHERE student_id = v_b.student_id;
  IF v_prior_count = 0 THEN v_first_mission_bonus := 25; END IF;

  -- Primary pillar
  v_pillar := v_c.primary_pillar;
  v_total := 50 + v_first_mission_bonus + v_full_day_bonus + v_multi_day_bonus;
  INSERT INTO public.student_xp_awards
    (student_id, booking_id, course_id, pillar, xp, base_xp,
     bonus_first_mission, bonus_full_day, bonus_multi_day, is_secondary)
  VALUES
    (v_b.student_id, v_b.id, v_b.course_id, v_pillar, v_total, 50,
     v_first_mission_bonus, v_full_day_bonus, v_multi_day_bonus, false)
  ON CONFLICT (booking_id, pillar) DO NOTHING;

  -- Secondary pillar (half XP, no first-mission bonus stacking)
  IF v_c.secondary_pillar IS NOT NULL AND v_c.secondary_pillar <> v_c.primary_pillar THEN
    v_total := 25 + (v_full_day_bonus / 2) + (v_multi_day_bonus / 2);
    INSERT INTO public.student_xp_awards
      (student_id, booking_id, course_id, pillar, xp, base_xp,
       bonus_full_day, bonus_multi_day, is_secondary)
    VALUES
      (v_b.student_id, v_b.id, v_b.course_id, v_c.secondary_pillar, v_total, 25,
       v_full_day_bonus / 2, v_multi_day_bonus / 2, true)
    ON CONFLICT (booking_id, pillar) DO NOTHING;
  END IF;
END;
$$;

-- 5. Trigger on booking attendance
CREATE OR REPLACE FUNCTION public.tg_award_pillar_xp_on_attended()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'attended' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.award_pillar_xp_for_booking(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_pillar_xp_on_attended ON public.bookings;
CREATE TRIGGER trg_award_pillar_xp_on_attended
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_award_pillar_xp_on_attended();

-- 6. 5-star review bonus: when a review is inserted with rating=5, add +10 to all
-- pillar awards for that booking.
CREATE OR REPLACE FUNCTION public.tg_award_five_star_bonus()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.rating = 5 AND NEW.booking_id IS NOT NULL THEN
    UPDATE public.student_xp_awards
       SET bonus_five_star = 10,
           xp = xp - bonus_five_star + 10,
           updated_at = now()
     WHERE booking_id = NEW.booking_id
       AND bonus_five_star = 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_five_star_bonus ON public.reviews;
CREATE TRIGGER trg_award_five_star_bonus
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_award_five_star_bonus();

-- 7. Aggregate view: per-student per-pillar totals (used by client)
CREATE OR REPLACE VIEW public.student_pillar_xp_v AS
SELECT
  student_id,
  pillar,
  COALESCE(SUM(xp), 0)::int AS total_xp,
  COUNT(*)::int AS awards_count
FROM public.student_xp_awards
GROUP BY student_id, pillar;

GRANT SELECT ON public.student_pillar_xp_v TO authenticated;