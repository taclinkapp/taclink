-- History log for training goal completion toggles
CREATE TABLE public.training_goal_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES public.training_goals(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('marked_complete', 'marked_incomplete')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_training_goal_events_goal_id ON public.training_goal_events(goal_id, created_at DESC);

ALTER TABLE public.training_goal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view their own goal events"
  ON public.training_goal_events FOR SELECT
  USING (auth.uid() = student_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students create their own goal events"
  ON public.training_goal_events FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students delete their own goal events"
  ON public.training_goal_events FOR DELETE
  USING (auth.uid() = student_id);
