
-- Seed default commission percent (2%)
INSERT INTO public.platform_settings (key, value, description, category)
VALUES ('default_influencer_commission_pct', '2'::jsonb, 'Default % of course price paid to an influencer when an attributed user attends a booking. Per-link override available.', 'influencer')
ON CONFLICT (key) DO NOTHING;

-- Influencer links
CREATE TABLE public.influencer_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  influencer_name text NOT NULL,
  influencer_handle text,
  influencer_email text,
  audience text NOT NULL DEFAULT 'both' CHECK (audience IN ('student','instructor','both')),
  commission_pct numeric(5,2),
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_influencer_links_slug_active ON public.influencer_links (slug) WHERE active;

ALTER TABLE public.influencer_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage influencer links" ON public.influencer_links
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Public reads active influencer links" ON public.influencer_links
  FOR SELECT TO anon, authenticated
  USING (active = true);

CREATE TRIGGER trg_influencer_links_updated_at
  BEFORE UPDATE ON public.influencer_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Signups attributed to a link
CREATE TABLE public.influencer_link_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.influencer_links(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  user_role public.app_role,
  signed_up_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_influencer_link_signups_link ON public.influencer_link_signups(link_id);

ALTER TABLE public.influencer_link_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read influencer signups" ON public.influencer_link_signups
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Commissions
CREATE TABLE public.influencer_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.influencer_links(id) ON DELETE CASCADE,
  signup_id uuid NOT NULL REFERENCES public.influencer_link_signups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  booking_id uuid NOT NULL UNIQUE,
  course_price_cents integer NOT NULL DEFAULT 0,
  pct_at_time numeric(5,2) NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued','paid','void')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_influencer_commissions_link ON public.influencer_commissions(link_id);
CREATE INDEX idx_influencer_commissions_user ON public.influencer_commissions(user_id);

ALTER TABLE public.influencer_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read influencer commissions" ON public.influencer_commissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update influencer commissions" ON public.influencer_commissions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_influencer_commissions_updated_at
  BEFORE UPDATE ON public.influencer_commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend handle_new_user to record influencer attribution from raw_user_meta_data.influencer_slug
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
  v_display_name text;
  v_referral_code text;
  v_referrer record;
  v_inf_slug text;
  v_inf_link record;
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
    NEW.id, v_display_name,
    NEW.raw_user_meta_data->>'photo_url',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'state',
    NEW.raw_user_meta_data->>'bio'
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

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

  -- Influencer link attribution
  v_inf_slug := LOWER(NULLIF(NEW.raw_user_meta_data->>'influencer_slug', ''));
  IF v_inf_slug IS NOT NULL THEN
    SELECT id, audience, active INTO v_inf_link
      FROM public.influencer_links WHERE slug = v_inf_slug;
    IF FOUND AND v_inf_link.active
       AND (v_inf_link.audience = 'both' OR v_inf_link.audience = v_role::text) THEN
      INSERT INTO public.influencer_link_signups (link_id, user_id, user_role)
      VALUES (v_inf_link.id, NEW.id, v_role)
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Accrue commission when booking flips to attended
CREATE OR REPLACE FUNCTION public.accrue_influencer_commission_on_attended()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_signup record;
  v_link record;
  v_default_pct numeric(5,2);
  v_pct numeric(5,2);
  v_price int;
  v_amount int;
  v_setting jsonb;
BEGIN
  IF NEW.status <> 'attended' OR (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_signup FROM public.influencer_link_signups WHERE user_id = NEW.student_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT * INTO v_link FROM public.influencer_links WHERE id = v_signup.link_id;
  IF NOT FOUND OR NOT v_link.active THEN RETURN NEW; END IF;

  SELECT value INTO v_setting FROM public.platform_settings WHERE key = 'default_influencer_commission_pct';
  BEGIN
    v_default_pct := COALESCE((v_setting #>> '{}')::numeric, 2.00);
  EXCEPTION WHEN OTHERS THEN
    v_default_pct := 2.00;
  END;

  v_pct := COALESCE(v_link.commission_pct, v_default_pct, 2.00);
  v_price := COALESCE(NEW.course_price_cents, 0);
  v_amount := ROUND(v_price * v_pct / 100.0)::int;

  INSERT INTO public.influencer_commissions
    (link_id, signup_id, user_id, booking_id, course_price_cents, pct_at_time, amount_cents)
  VALUES
    (v_link.id, v_signup.id, NEW.student_id, NEW.id, v_price, v_pct, v_amount)
  ON CONFLICT (booking_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_accrue_influencer_commission ON public.bookings;
CREATE TRIGGER trg_accrue_influencer_commission
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.accrue_influencer_commission_on_attended();
