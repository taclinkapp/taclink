CREATE TABLE IF NOT EXISTS public.student_onboarding (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  experience_level TEXT,
  training_goal TEXT,
  selected_pillars TEXT[] DEFAULT '{}',
  travel_radius_miles INTEGER,
  checklist JSONB NOT NULL DEFAULT '{
    "profile_created": true,
    "browsed_courses": false,
    "followed_instructor": false,
    "first_booking": false,
    "first_completion": false,
    "shared_profile": false
  }'::jsonb,
  checklist_dismissed BOOLEAN NOT NULL DEFAULT false,
  tooltips_seen TEXT[] NOT NULL DEFAULT '{}',
  notif_prompt_shown BOOLEAN NOT NULL DEFAULT false,
  quiz_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.student_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own onboarding" ON public.student_onboarding FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own onboarding" ON public.student_onboarding FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own onboarding" ON public.student_onboarding FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_student_onboarding_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_student_onboarding_updated_at
  BEFORE UPDATE ON public.student_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.touch_student_onboarding_updated_at();