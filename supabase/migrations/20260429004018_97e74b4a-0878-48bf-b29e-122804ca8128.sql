
CREATE TABLE public.referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  user_role public.app_role NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can lookup referral codes"
  ON public.referral_codes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users insert their own referral code"
  ON public.referral_codes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all referral codes"
  ON public.referral_codes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referrer_role public.app_role NOT NULL,
  referred_user_id UUID NOT NULL UNIQUE,
  code_used TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  rewarded_at TIMESTAMPTZ,
  reward_type TEXT,
  reward_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrers view their referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert referrals"
  ON public.referrals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = referred_user_id);

CREATE POLICY "Admins manage all referrals"
  ON public.referrals FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.student_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  credit_type TEXT NOT NULL DEFAULT 'free_booking',
  source TEXT NOT NULL DEFAULT 'referral',
  note TEXT,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at TIMESTAMPTZ,
  redeemed_booking_id UUID
);

ALTER TABLE public.student_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view their credits"
  ON public.student_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Students update their credits (redeem)"
  ON public.student_credits FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "System inserts student credits"
  ON public.student_credits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Admins manage all student credits"
  ON public.student_credits FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Code generator using md5(random) - no extensions needed
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_attempt INT := 0;
BEGIN
  LOOP
    v_code := UPPER(SUBSTRING(MD5(random()::text || clock_timestamp()::text) FROM 1 FOR 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referral_codes WHERE code = v_code);
    v_attempt := v_attempt + 1;
    IF v_attempt > 20 THEN
      v_code := UPPER(SUBSTRING(MD5(random()::text || clock_timestamp()::text) FROM 1 FOR 12));
      EXIT;
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role public.app_role;
  v_display_name text;
  v_referral_code text;
  v_referrer record;
BEGIN
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  v_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'role', '')::public.app_role,
    'student'
  );

  INSERT INTO public.profiles (id, display_name, photo_url, phone, state, bio)
  VALUES (
    NEW.id,
    v_display_name,
    NEW.raw_user_meta_data->>'photo_url',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'state',
    NEW.raw_user_meta_data->>'bio'
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role);

  INSERT INTO public.referral_codes (user_id, user_role, code)
  VALUES (NEW.id, v_role, public.generate_referral_code())
  ON CONFLICT (user_id) DO NOTHING;

  v_referral_code := UPPER(NULLIF(NEW.raw_user_meta_data->>'referral_code', ''));
  IF v_referral_code IS NOT NULL THEN
    SELECT user_id, user_role INTO v_referrer
      FROM public.referral_codes WHERE code = v_referral_code;
    IF FOUND AND v_referrer.user_id <> NEW.id THEN
      INSERT INTO public.referrals (referrer_id, referrer_role, referred_user_id, code_used, status)
      VALUES (v_referrer.user_id, v_referrer.user_role, NEW.id, v_referral_code, 'pending')
      ON CONFLICT (referred_user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_referral_on_first_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ref public.referrals%ROWTYPE;
  v_prior_count int;
  v_credit_id uuid;
BEGIN
  SELECT * INTO v_ref FROM public.referrals
   WHERE referred_user_id = NEW.student_id AND status = 'pending'
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_prior_count FROM public.bookings
   WHERE student_id = NEW.student_id AND id <> NEW.id;
  IF v_prior_count > 0 THEN
    RETURN NEW;
  END IF;

  IF v_ref.referrer_role = 'student' THEN
    INSERT INTO public.student_credits (student_id, credit_type, source, note)
    VALUES (v_ref.referrer_id, 'free_booking', 'referral', 'Referral reward')
    RETURNING id INTO v_credit_id;

    UPDATE public.referrals
       SET status = 'rewarded', rewarded_at = now(),
           reward_type = 'student_free_booking', reward_id = v_credit_id,
           updated_at = now()
     WHERE id = v_ref.id;

  ELSIF v_ref.referrer_role = 'instructor' THEN
    INSERT INTO public.instructor_credits (instructor_id, credit_type, source, note)
    VALUES (v_ref.referrer_id, 'free_listing_fee', 'referral', 'Referral reward')
    RETURNING id INTO v_credit_id;

    UPDATE public.referrals
       SET status = 'rewarded', rewarded_at = now(),
           reward_type = 'instructor_free_listing', reward_id = v_credit_id,
           updated_at = now()
     WHERE id = v_ref.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_referral_on_first_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.award_referral_on_first_booking();

-- Backfill referral codes for existing users
INSERT INTO public.referral_codes (user_id, user_role, code)
SELECT ur.user_id,
       (SELECT role FROM public.user_roles WHERE user_id = ur.user_id ORDER BY created_at ASC LIMIT 1),
       public.generate_referral_code()
FROM (SELECT DISTINCT user_id FROM public.user_roles) ur
ON CONFLICT (user_id) DO NOTHING;
