
-- 1. Add access_pin column to influencer_links
ALTER TABLE public.influencer_links
  ADD COLUMN IF NOT EXISTS access_pin text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_influencer_links_access_pin
  ON public.influencer_links(access_pin)
  WHERE access_pin IS NOT NULL;

-- 2. Helper: generate a random 6-char uppercase alphanumeric PIN
CREATE OR REPLACE FUNCTION public.generate_access_pin()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  pin text := '';
  i int;
  exists_count int;
BEGIN
  LOOP
    pin := '';
    FOR i IN 1..6 LOOP
      pin := pin || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    SELECT count(*) INTO exists_count FROM public.influencer_links WHERE access_pin = pin;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN pin;
END;
$$;

-- 3. Backfill existing rows with a PIN
UPDATE public.influencer_links
SET access_pin = public.generate_access_pin()
WHERE access_pin IS NULL;

-- 4. Trigger: auto-generate PIN on insert if not provided
CREATE OR REPLACE FUNCTION public.influencer_links_auto_pin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.access_pin IS NULL OR NEW.access_pin = '' THEN
    NEW.access_pin := public.generate_access_pin();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_influencer_links_auto_pin ON public.influencer_links;
CREATE TRIGGER trg_influencer_links_auto_pin
  BEFORE INSERT ON public.influencer_links
  FOR EACH ROW EXECUTE FUNCTION public.influencer_links_auto_pin();

-- 5. RPC: retrieve guest affiliate stats by slug + PIN
CREATE OR REPLACE FUNCTION public.get_guest_affiliate_stats(
  _slug text,
  _pin text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  link_rec public.influencer_links;
  result jsonb;
BEGIN
  SELECT * INTO link_rec
  FROM public.influencer_links
  WHERE slug = lower(_slug)
    AND access_pin = upper(_pin);

  IF link_rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid slug or PIN');
  END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'link', jsonb_build_object(
      'id', link_rec.id,
      'slug', link_rec.slug,
      'influencer_name', link_rec.influencer_name,
      'influencer_email', link_rec.influencer_email,
      'audience', link_rec.audience,
      'active', link_rec.active,
      'is_vip', link_rec.is_vip,
      'vip_pct', link_rec.vip_pct,
      'vip_duration_days', link_rec.vip_duration_days,
      'vip_starts_at', link_rec.vip_starts_at,
      'first_booking_pct', link_rec.first_booking_pct,
      'recurring_pct', link_rec.recurring_pct,
      'recurring_window_days', link_rec.recurring_window_days,
      'payout_method', link_rec.payout_method,
      'payout_handle', link_rec.payout_handle,
      'payout_notes', link_rec.payout_notes
    ),
    'signup_count', (
      SELECT count(*)::int FROM public.influencer_link_signups WHERE link_id = link_rec.id
    ),
    'commissions', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'amount_cents', c.amount_cents,
          'pct_at_time', c.pct_at_time,
          'status', c.status,
          'commission_kind', c.commission_kind,
          'created_at', c.created_at
        ) ORDER BY c.created_at DESC
      ), '[]'::jsonb)
      FROM public.influencer_commissions c WHERE c.link_id = link_rec.id
    ),
    'payouts', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'amount_cents', p.amount_cents,
          'method', p.method,
          'reference', p.reference,
          'notes', p.notes,
          'paid_at', p.paid_at
        ) ORDER BY p.paid_at DESC
      ), '[]'::jsonb)
      FROM public.influencer_payouts p WHERE p.link_id = link_rec.id
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- 6. RPC: update guest affiliate payout info by slug + PIN
CREATE OR REPLACE FUNCTION public.update_guest_affiliate_payout(
  _slug text,
  _pin text,
  _method text,
  _handle text,
  _notes text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  link_rec public.influencer_links;
BEGIN
  SELECT * INTO link_rec
  FROM public.influencer_links
  WHERE slug = lower(_slug)
    AND access_pin = upper(_pin);

  IF link_rec.id IS NULL THEN
    RETURN false;
  END IF;

  IF _method NOT IN ('cashapp','venmo','paypal','zelle','other') THEN
    RAISE EXCEPTION 'Invalid payout method';
  END IF;

  UPDATE public.influencer_links
  SET payout_method = _method,
      payout_handle = NULLIF(trim(_handle), ''),
      payout_notes = NULLIF(trim(_notes), ''),
      updated_at = now()
  WHERE id = link_rec.id;

  RETURN true;
END;
$$;

-- 7. RPC: regenerate access pin (admin only)
CREATE OR REPLACE FUNCTION public.regenerate_affiliate_access_pin(
  _link_id uuid
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_pin text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  new_pin := public.generate_access_pin();

  UPDATE public.influencer_links
  SET access_pin = new_pin, updated_at = now()
  WHERE id = _link_id;

  RETURN new_pin;
END;
$$;

-- Grants for RPCs
GRANT EXECUTE ON FUNCTION public.get_guest_affiliate_stats(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_guest_affiliate_payout(text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_affiliate_access_pin(uuid) TO authenticated;
