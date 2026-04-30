
-- 1. Commission % audit log (per-link + global default)
CREATE TABLE public.influencer_commission_pct_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('link','global_default')),
  link_id uuid REFERENCES public.influencer_links(id) ON DELETE CASCADE,
  old_pct numeric(5,2),
  new_pct numeric(5,2),
  changed_by uuid,
  reason text,
  effective_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inf_pct_audit_link ON public.influencer_commission_pct_audit(link_id, effective_at DESC);
CREATE INDEX idx_inf_pct_audit_scope ON public.influencer_commission_pct_audit(scope, effective_at DESC);

ALTER TABLE public.influencer_commission_pct_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read commission pct audit" ON public.influencer_commission_pct_audit
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins insert commission pct audit" ON public.influencer_commission_pct_audit
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Auto-capture per-link commission_pct changes
CREATE OR REPLACE FUNCTION public.log_influencer_link_pct_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.commission_pct IS DISTINCT FROM OLD.commission_pct) THEN
    INSERT INTO public.influencer_commission_pct_audit
      (scope, link_id, old_pct, new_pct, changed_by, effective_at)
    VALUES
      ('link', NEW.id, OLD.commission_pct, NEW.commission_pct, auth.uid(), now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_influencer_link_pct ON public.influencer_links;
CREATE TRIGGER trg_log_influencer_link_pct
  AFTER UPDATE OF commission_pct ON public.influencer_links
  FOR EACH ROW EXECUTE FUNCTION public.log_influencer_link_pct_change();

-- Auto-capture global default commission % changes
CREATE OR REPLACE FUNCTION public.log_influencer_default_pct_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old numeric(5,2);
  v_new numeric(5,2);
BEGIN
  IF NEW.key <> 'default_influencer_commission_pct' THEN RETURN NEW; END IF;
  BEGIN v_old := (OLD.value #>> '{}')::numeric; EXCEPTION WHEN OTHERS THEN v_old := NULL; END;
  BEGIN v_new := (NEW.value #>> '{}')::numeric; EXCEPTION WHEN OTHERS THEN v_new := NULL; END;
  IF v_old IS DISTINCT FROM v_new THEN
    INSERT INTO public.influencer_commission_pct_audit
      (scope, link_id, old_pct, new_pct, changed_by, effective_at)
    VALUES
      ('global_default', NULL, v_old, v_new, auth.uid(), now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_influencer_default_pct ON public.platform_settings;
CREATE TRIGGER trg_log_influencer_default_pct
  AFTER UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_influencer_default_pct_change();

-- 2. Landing page redirect/visit log
CREATE TABLE public.influencer_link_redirect_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  link_id uuid REFERENCES public.influencer_links(id) ON DELETE SET NULL,
  outcome text NOT NULL CHECK (outcome IN ('matched_student','matched_instructor','chooser_shown','audience_mismatch_fallback','link_inactive','link_not_found')),
  audience_on_link text,
  detected_role text,
  user_id uuid,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inf_redirect_log_slug ON public.influencer_link_redirect_log(slug, created_at DESC);
CREATE INDEX idx_inf_redirect_log_link ON public.influencer_link_redirect_log(link_id, created_at DESC);

ALTER TABLE public.influencer_link_redirect_log ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon visitors) can record their own visit.
CREATE POLICY "Public can log link visits" ON public.influencer_link_redirect_log
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins read link visit log" ON public.influencer_link_redirect_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Slug availability helper (case-insensitive)
CREATE OR REPLACE FUNCTION public.is_influencer_slug_available(_slug text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.influencer_links WHERE LOWER(slug) = LOWER(_slug)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_influencer_slug_available(text) TO anon, authenticated;

-- 4. Harden the attendance trigger: ensure commission accrues exactly once
-- even if the booking's status flips attended -> something -> attended again.
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
  v_already_exists boolean;
BEGIN
  -- Only act when status is now 'attended'.
  IF NEW.status <> 'attended' THEN
    RETURN NEW;
  END IF;

  -- Skip if status didn't actually change (covers no-op UPDATEs).
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Hard idempotency guard: never create a second commission for the same booking.
  SELECT EXISTS(SELECT 1 FROM public.influencer_commissions WHERE booking_id = NEW.id)
    INTO v_already_exists;
  IF v_already_exists THEN
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

-- Backfill: seed an initial audit entry for the current global default so the
-- history view has a baseline starting point.
INSERT INTO public.influencer_commission_pct_audit (scope, link_id, old_pct, new_pct, changed_by, reason, effective_at)
SELECT 'global_default', NULL, NULL,
       COALESCE((value #>> '{}')::numeric, 2.00),
       NULL, 'Initial baseline', now()
  FROM public.platform_settings
 WHERE key = 'default_influencer_commission_pct'
   AND NOT EXISTS (
     SELECT 1 FROM public.influencer_commission_pct_audit WHERE scope = 'global_default'
   );
