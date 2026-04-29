-- 1. PLATFORM SETTINGS ---------------------------------------------------
CREATE TABLE public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage platform settings"
  ON public.platform_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_platform_settings_updated
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. FEATURE FLAGS -------------------------------------------------------
CREATE TABLE public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  audience TEXT NOT NULL DEFAULT 'all', -- 'all' | 'students' | 'instructors' | 'admins'
  rollout_pct INTEGER NOT NULL DEFAULT 100 CHECK (rollout_pct BETWEEN 0 AND 100),
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature flags"
  ON public.feature_flags FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage feature flags"
  ON public.feature_flags FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_feature_flags_updated
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. ADMIN AUDIT LOG -----------------------------------------------------
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  admin_email TEXT,
  action TEXT NOT NULL,           -- e.g. 'suspend_user', 'override_fee', 'toggle_flag'
  target_type TEXT,               -- e.g. 'user', 'course', 'booking', 'setting', 'flag'
  target_id TEXT,
  before_value JSONB,
  after_value JSONB,
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'admin_ui', -- 'admin_ui' | 'admin_ai' | 'system'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_log_admin ON public.admin_audit_log(admin_id);
CREATE INDEX idx_admin_audit_log_target ON public.admin_audit_log(target_type, target_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins insert audit entries"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) AND admin_id = auth.uid());

-- Helper for security-definer writes
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action TEXT,
  _target_type TEXT,
  _target_id TEXT,
  _before JSONB,
  _after JSONB,
  _reason TEXT DEFAULT NULL,
  _source TEXT DEFAULT 'admin_ui'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can log admin actions';
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, before_value, after_value, reason, source)
  VALUES (auth.uid(), _action, _target_type, _target_id, _before, _after, _reason, _source)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 4. FEATURED COURSE PLACEMENTS -----------------------------------------
CREATE TABLE public.course_featured_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_featured_sort ON public.course_featured_placements(sort_order);

ALTER TABLE public.course_featured_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view featured placements"
  ON public.course_featured_placements FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage featured placements"
  ON public.course_featured_placements FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5. SEED DEFAULT SETTINGS ----------------------------------------------
INSERT INTO public.platform_settings (key, value, description, category) VALUES
  ('platform_fee_cents', '2500'::jsonb, 'Default platform fee per booking, in cents.', 'fees'),
  ('instructor_deposit_cents', '0'::jsonb, 'Default deposit charged to instructor, in cents.', 'fees'),
  ('deposit_window_minutes', '60'::jsonb, 'Minutes a student has to send the deposit before it expires.', 'bookings'),
  ('maintenance_mode', 'false'::jsonb, 'When true, end-user app shows maintenance screen.', 'general'),
  ('launch_date', '"2026-06-01"'::jsonb, 'Public launch date shown on splash and marketing screens.', 'general'),
  ('ai_moderation_threshold', '0.7'::jsonb, 'Minimum AI confidence (0-1) before auto-flagging content.', 'moderation'),
  ('support_email', '"support@taclinkapp.com"'::jsonb, 'Public support contact email.', 'general'),
  ('referral_reward_enabled', 'true'::jsonb, 'Toggles the referral reward system on/off.', 'referrals')
ON CONFLICT (key) DO NOTHING;

-- 6. SEED DEFAULT FLAGS --------------------------------------------------
INSERT INTO public.feature_flags (key, enabled, description, audience) VALUES
  ('referrals', true, 'Show referral QR/invite UI to users.', 'all'),
  ('ai_assistant_student', true, 'Show the student AI Buddy chat panel.', 'students'),
  ('ai_assistant_instructor', true, 'Show the instructor AI Coach chat panel.', 'instructors'),
  ('admin_ai_assistant', true, 'Show the Admin AI assistant panel.', 'admins'),
  ('listing_packs', true, 'Allow instructors to buy listing packs.', 'instructors'),
  ('discover_banner', true, 'Show the Discover-page promo banner.', 'students')
ON CONFLICT (key) DO NOTHING;