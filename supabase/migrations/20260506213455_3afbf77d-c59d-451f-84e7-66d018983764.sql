-- Backfill in_person_waiver=true for any course that has no published e-sign waiver.
-- This corrects rows created before the in_person_waiver column existed.
UPDATE public.courses c
SET in_person_waiver = true
WHERE in_person_waiver = false
  AND NOT EXISTS (
    SELECT 1 FROM public.course_waivers w
    WHERE w.course_id = c.id AND w.published = true
  );