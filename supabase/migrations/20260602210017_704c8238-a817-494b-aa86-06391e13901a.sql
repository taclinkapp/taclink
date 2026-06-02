
-- VIP affiliate link tier
ALTER TABLE public.influencer_links
  ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vip_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS vip_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS vip_duration_days integer;

ALTER TABLE public.influencer_links
  DROP CONSTRAINT IF EXISTS influencer_links_vip_check;
ALTER TABLE public.influencer_links
  ADD CONSTRAINT influencer_links_vip_check
  CHECK (
    NOT is_vip
    OR (vip_pct IS NOT NULL AND vip_pct >= 0 AND vip_pct <= 100
        AND (vip_duration_days IS NULL OR (vip_duration_days >= 1 AND vip_duration_days <= 3650)))
  );

-- Allow 'vip' as a commission_kind
ALTER TABLE public.influencer_commissions
  DROP CONSTRAINT IF EXISTS influencer_commissions_commission_kind_check;
ALTER TABLE public.influencer_commissions
  ADD CONSTRAINT influencer_commissions_commission_kind_check
  CHECK (commission_kind IN ('first','recurring','vip'));

-- Helper: is the VIP window currently active?
CREATE OR REPLACE FUNCTION public.influencer_link_vip_active(_link public.influencer_links)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _link.is_vip
     AND _link.active
     AND _link.vip_pct IS NOT NULL
     AND (_link.vip_starts_at IS NULL OR _link.vip_starts_at <= now())
     AND (
       _link.vip_duration_days IS NULL
       OR COALESCE(_link.vip_starts_at, _link.created_at) + (_link.vip_duration_days || ' days')::interval > now()
     );
$$;

-- Rewrite accrual trigger to honor VIP mode (flat % per booking, no first/recurring split)
CREATE OR REPLACE FUNCTION public.accrue_influencer_commission_on_attended()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_signup record;
  v_link public.influencer_links%ROWTYPE;
  v_default_first numeric(5,2);
  v_default_recurring numeric(5,2);
  v_default_window int;
  v_first_pct numeric(5,2);
  v_recurring_pct numeric(5,2);
  v_window_days int;
  v_pct numeric(5,2);
  v_price int;
  v_amount int;
  v_setting jsonb;
  v_prior_count int;
  v_kind text;
  v_window_end timestamptz;
  v_vip_expiry timestamptz;
BEGIN
  IF NEW.status <> 'attended' THEN RETURN NEW; END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM public.influencer_commissions WHERE booking_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_signup FROM public.influencer_link_signups WHERE user_id = NEW.student_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT * INTO v_link FROM public.influencer_links WHERE id = v_signup.link_id;
  IF NOT FOUND OR NOT v_link.active THEN RETURN NEW; END IF;

  v_price := COALESCE(NEW.course_price_cents, 0);

  -- VIP path: flat % per booking, capped by optional duration window.
  IF v_link.is_vip AND v_link.vip_pct IS NOT NULL THEN
    IF v_link.vip_starts_at IS NOT NULL AND v_link.vip_starts_at > now() THEN
      RETURN NEW; -- not started yet
    END IF;
    IF v_link.vip_duration_days IS NOT NULL THEN
      v_vip_expiry := COALESCE(v_link.vip_starts_at, v_link.created_at)
                      + (v_link.vip_duration_days || ' days')::interval;
      IF now() > v_vip_expiry THEN RETURN NEW; END IF;
    END IF;
    v_pct := v_link.vip_pct;
    v_kind := 'vip';
    v_amount := ROUND(v_price * v_pct / 100.0)::int;
    IF v_amount <= 0 THEN RETURN NEW; END IF;
    INSERT INTO public.influencer_commissions
      (link_id, signup_id, user_id, booking_id, course_price_cents, pct_at_time, amount_cents, commission_kind)
    VALUES
      (v_link.id, v_signup.id, NEW.student_id, NEW.id, v_price, v_pct, v_amount, v_kind)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  -- Non-VIP hybrid model (existing behavior)
  SELECT value INTO v_setting FROM public.platform_settings WHERE key = 'default_influencer_first_booking_pct';
  BEGIN v_default_first := COALESCE((v_setting #>> '{}')::numeric, 5.00); EXCEPTION WHEN OTHERS THEN v_default_first := 5.00; END;

  SELECT value INTO v_setting FROM public.platform_settings WHERE key = 'default_influencer_recurring_pct';
  BEGIN v_default_recurring := COALESCE((v_setting #>> '{}')::numeric, 1.00); EXCEPTION WHEN OTHERS THEN v_default_recurring := 1.00; END;

  SELECT value INTO v_setting FROM public.platform_settings WHERE key = 'default_influencer_recurring_window_days';
  BEGIN v_default_window := COALESCE((v_setting #>> '{}')::int, 180); EXCEPTION WHEN OTHERS THEN v_default_window := 180; END;

  v_first_pct := COALESCE(v_link.first_booking_pct, v_link.commission_pct, v_default_first);
  v_recurring_pct := COALESCE(v_link.recurring_pct, v_default_recurring);
  v_window_days := COALESCE(v_link.recurring_window_days, v_default_window);

  SELECT COUNT(*) INTO v_prior_count
    FROM public.influencer_commissions
   WHERE user_id = NEW.student_id AND status <> 'void';

  IF v_prior_count = 0 THEN
    v_kind := 'first';
    v_pct := v_first_pct;
  ELSE
    v_window_end := v_signup.signed_up_at + (v_window_days || ' days')::interval;
    IF now() > v_window_end THEN RETURN NEW; END IF;
    IF v_recurring_pct IS NULL OR v_recurring_pct <= 0 THEN RETURN NEW; END IF;
    v_kind := 'recurring';
    v_pct := v_recurring_pct;
  END IF;

  v_amount := ROUND(v_price * v_pct / 100.0)::int;
  IF v_amount <= 0 THEN RETURN NEW; END IF;

  INSERT INTO public.influencer_commissions
    (link_id, signup_id, user_id, booking_id, course_price_cents, pct_at_time, amount_cents, commission_kind)
  VALUES
    (v_link.id, v_signup.id, NEW.student_id, NEW.id, v_price, v_pct, v_amount, v_kind)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
