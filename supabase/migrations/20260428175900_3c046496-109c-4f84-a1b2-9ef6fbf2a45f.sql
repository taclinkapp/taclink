-- Goal type enum
CREATE TYPE public.training_goal_type AS ENUM (
  'course_count',
  'category_count',
  'specific_category',
  'custom'
);

-- Shared updated_at helper (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Goals table
CREATE TABLE public.training_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  goal_type public.training_goal_type NOT NULL DEFAULT 'course_count',
  target_count INTEGER NOT NULL DEFAULT 1 CHECK (target_count > 0),
  category TEXT,
  deadline DATE,
  completed_manually BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_training_goals_student ON public.training_goals(student_id);

-- RLS
ALTER TABLE public.training_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view their own goals"
  ON public.training_goals FOR SELECT
  USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students create their own goals"
  ON public.training_goals FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students update their own goals"
  ON public.training_goals FOR UPDATE
  USING (auth.uid() = student_id);

CREATE POLICY "Students delete their own goals"
  ON public.training_goals FOR DELETE
  USING (auth.uid() = student_id);

CREATE TRIGGER update_training_goals_updated_at
  BEFORE UPDATE ON public.training_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();