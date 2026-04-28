-- bypass_attempts: log every contact-info sharing attempt
CREATE TABLE public.bypass_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_role TEXT,
  field_name TEXT NOT NULL,
  original_content TEXT NOT NULL,
  redacted_content TEXT,
  detected_pattern TEXT NOT NULL,
  action_taken TEXT NOT NULL CHECK (action_taken IN ('redacted', 'blocked', 'warned')),
  context JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_bypass_attempts_user_id ON public.bypass_attempts(user_id, created_at DESC);
CREATE INDEX idx_bypass_attempts_created_at ON public.bypass_attempts(created_at DESC);

ALTER TABLE public.bypass_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can log their own attempts"
  ON public.bypass_attempts FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Admins can view all bypass attempts"
  ON public.bypass_attempts FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own bypass attempts"
  ON public.bypass_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- policy_acknowledgments: immutable record of policy agreement
CREATE TABLE public.policy_acknowledgments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  policy_version TEXT NOT NULL DEFAULT 'v1.0',
  user_agent TEXT,
  ip_hint TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_policy_ack_user_id ON public.policy_acknowledgments(user_id, created_at DESC);

ALTER TABLE public.policy_acknowledgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own acknowledgment"
  ON public.policy_acknowledgments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view their own acknowledgments"
  ON public.policy_acknowledgments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all acknowledgments"
  ON public.policy_acknowledgments FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Note: deliberately NO UPDATE or DELETE policies — table is append-only.

-- Add flagging columns to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason TEXT;

-- Add optional booking link to conversations (used by the booking gate)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS booking_id UUID;

CREATE INDEX IF NOT EXISTS idx_conversations_booking_id ON public.conversations(booking_id);