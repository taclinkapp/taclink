-- 1. Per-link override columns
ALTER TABLE public.influencer_links
  ADD COLUMN IF NOT EXISTS first_booking_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS recurring_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS recurring_window_days integer;

-- 2. Tag commissions with kind
ALTER TABLE public.influencer_commissions
  ADD COLUMN IF NOT EXISTS commission_kind text NOT NULL DEFAULT 'first';

-- 3. Replace old uniqueness: one commission per booking (not per user)
DROP INDEX IF EXISTS uq_influencer_commissions_user;
CREATE UNIQUE INDEX IF NOT EXISTS uq_influencer_commissions_user_booking
  ON public.influencer_commissions (user_id, booking_id);

-- 4. Seed new global defaults
INSERT INTO public.platform_settings (key, value, description, category) VALUES
  ('default_influencer_first_booking_pct', '5'::jsonb,
    'Default % of course price paid to influencer on a referred user''s FIRST attended booking.', 'influencer'),
  ('default_influencer_recurring_pct', '1'::jsonb,
    'Default % paid on subsequent attended bookings (after the first).', 'influencer'),
  ('default_influencer_recurring_window_days', '180'::jsonb,
    'Number of days after signup during which recurring commissions are paid. After this window, recurring stops.', 'influencer')
ON CONFLICT (key) DO NOTHING;

-- 5. Rewrite the accrual trigger for hybrid model
CREATE OR REPLACE FUNCTION public.accrue_influencer_commission_on_attended()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_signup record;
  v_link record;
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
BEGIN
  IF NEW.status <> 'attended' THEN RETURN NEW; END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  -- Idempotency: this exact booking already accrued? skip.
  IF EXISTS (SELECT 1 FROM public.influencer_commissions WHERE booking_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_signup FROM public.influencer_link_signups WHERE user_id = NEW.student_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT * INTO v_link FROM public.influencer_links WHERE id = v_signup.link_id;
  IF NOT FOUND OR NOT v_link.active THEN RETURN NEW; END IF;

  -- Load defaults
  SELECT value INTO v_setting FROM public.platform_settings WHERE key = 'default_influencer_first_booking_pct';
  BEGIN v_default_first := COALESCE((v_setting #>> '{}')::numeric, 5.00); EXCEPTION WHEN OTHERS THEN v_default_first := 5.00; END;

  SELECT value INTO v_setting FROM public.platform_settings WHERE key = 'default_influencer_recurring_pct';
  BEGIN v_default_recurring := COALESCE((v_setting #>> '{}')::numeric, 1.00); EXCEPTION WHEN OTHERS THEN v_default_recurring := 1.00; END;

  SELECT value INTO v_setting FROM public.platform_settings WHERE key = 'default_influencer_recurring_window_days';
  BEGIN v_default_window := COALESCE((v_setting #>> '{}')::int, 180); EXCEPTION WHEN OTHERS THEN v_default_window := 180; END;

  -- Per-link with legacy fallback (commission_pct used as first if first_booking_pct is null)
  v_first_pct := COALESCE(v_link.first_booking_pct, v_link.commission_pct, v_default_first);
  v_recurring_pct := COALESCE(v_link.recurring_pct, v_default_recurring);
  v_window_days := COALESCE(v_link.recurring_window_days, v_default_window);

  -- Has this user been paid before (excluding void)?
  SELECT COUNT(*) INTO v_prior_count
    FROM public.influencer_commissions
   WHERE user_id = NEW.student_id
     AND status <> 'void';

  IF v_prior_count = 0 THEN
    v_kind := 'first';
    v_pct := v_first_pct;
  ELSE
    -- Recurring: only inside the time window
    v_window_end := v_signup.signed_up_at + (v_window_days || ' days')::interval;
    IF now() > v_window_end THEN
      RETURN NEW; -- window expired
    END IF;
    IF v_recurring_pct IS NULL OR v_recurring_pct <= 0 THEN
      RETURN NEW; -- recurring disabled
    END IF;
    v_kind := 'recurring';
    v_pct := v_recurring_pct;
  END IF;

  v_price := COALESCE(NEW.course_price_cents, 0);
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