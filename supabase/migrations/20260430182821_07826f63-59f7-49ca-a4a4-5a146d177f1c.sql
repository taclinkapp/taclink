-- 1. Add a uniqueness guard so one user cannot generate more than one commission row.
--    (The previous unique constraint was on booking_id only, which still allowed
--    a second commission for a different booking from the same referred user.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_influencer_commissions_user
  ON public.influencer_commissions (user_id);

-- 2. Harden the accrual trigger: only the user's FIRST booking accrues commission.
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
  v_user_already_paid boolean;
BEGIN
  -- Only act when status is now 'attended'.
  IF NEW.status <> 'attended' THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- First-booking-only guard: any prior commission for this user (any status,
  -- including voided) blocks new accruals.
  SELECT EXISTS(
    SELECT 1 FROM public.influencer_commissions WHERE user_id = NEW.student_id
  ) INTO v_user_already_paid;
  IF v_user_already_paid THEN
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
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 3. Auto-void commissions for bookings that get cancelled / no-show.
CREATE OR REPLACE FUNCTION public.void_influencer_commission_on_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('cancelled', 'no_show')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.influencer_commissions
       SET status = 'void',
           updated_at = now()
     WHERE booking_id = NEW.id
       AND status = 'accrued';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_void_influencer_commission ON public.bookings;
CREATE TRIGGER trg_void_influencer_commission
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.void_influencer_commission_on_cancel();

-- 4. Seed pre-launch settings if they don't exist yet.
INSERT INTO public.platform_settings (key, value, description, category) VALUES
  ('prelaunch_mode', 'true'::jsonb, 'When true, the app is in pre-launch: instructors can browse and draft courses but cannot publish, and the monthly subscription page is hidden.', 'general')
ON CONFLICT (key) DO NOTHING;