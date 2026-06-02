-- 1) Add owner + payout-handle fields to influencer_links
ALTER TABLE public.influencer_links
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS payout_method text,
  ADD COLUMN IF NOT EXISTS payout_handle text,
  ADD COLUMN IF NOT EXISTS payout_notes text;

ALTER TABLE public.influencer_links
  DROP CONSTRAINT IF EXISTS influencer_links_payout_method_check;
ALTER TABLE public.influencer_links
  ADD CONSTRAINT influencer_links_payout_method_check
  CHECK (payout_method IS NULL OR payout_method IN ('cashapp','venmo','paypal','zelle','other'));

CREATE INDEX IF NOT EXISTS idx_influencer_links_owner ON public.influencer_links(owner_user_id);

-- Owners (affiliates) can read their own link
DROP POLICY IF EXISTS "Owners read their own link" ON public.influencer_links;
CREATE POLICY "Owners read their own link" ON public.influencer_links
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

-- Owners can update only their payout-handle fields on their own link
DROP POLICY IF EXISTS "Owners update payout handle on own link" ON public.influencer_links;
CREATE POLICY "Owners update payout handle on own link" ON public.influencer_links
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Trigger guard: owner edits are restricted to payout-handle fields only
CREATE OR REPLACE FUNCTION public.influencer_links_owner_edit_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Admins bypass this guard
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  -- For non-admin owners: only payout_method/handle/notes may change
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
     OR NEW.slug IS DISTINCT FROM OLD.slug
     OR NEW.influencer_name IS DISTINCT FROM OLD.influencer_name
     OR NEW.influencer_handle IS DISTINCT FROM OLD.influencer_handle
     OR NEW.influencer_email IS DISTINCT FROM OLD.influencer_email
     OR NEW.audience IS DISTINCT FROM OLD.audience
     OR NEW.commission_pct IS DISTINCT FROM OLD.commission_pct
     OR NEW.first_booking_pct IS DISTINCT FROM OLD.first_booking_pct
     OR NEW.recurring_pct IS DISTINCT FROM OLD.recurring_pct
     OR NEW.recurring_window_days IS DISTINCT FROM OLD.recurring_window_days
     OR NEW.is_vip IS DISTINCT FROM OLD.is_vip
     OR NEW.vip_pct IS DISTINCT FROM OLD.vip_pct
     OR NEW.vip_starts_at IS DISTINCT FROM OLD.vip_starts_at
     OR NEW.vip_duration_days IS DISTINCT FROM OLD.vip_duration_days
     OR NEW.active IS DISTINCT FROM OLD.active
     OR NEW.notes IS DISTINCT FROM OLD.notes
  THEN
    RAISE EXCEPTION 'Only payout handle fields may be edited by the link owner';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_influencer_links_owner_edit_guard ON public.influencer_links;
CREATE TRIGGER trg_influencer_links_owner_edit_guard
  BEFORE UPDATE ON public.influencer_links
  FOR EACH ROW EXECUTE FUNCTION public.influencer_links_owner_edit_guard();

-- Owners read their signups (counts only — anonymized via column policy below)
DROP POLICY IF EXISTS "Owners read their signups" ON public.influencer_link_signups;
CREATE POLICY "Owners read their signups" ON public.influencer_link_signups
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.influencer_links l
    WHERE l.id = link_id AND l.owner_user_id = auth.uid()
  ));

-- Owners read their own commissions
DROP POLICY IF EXISTS "Owners read their commissions" ON public.influencer_commissions;
CREATE POLICY "Owners read their commissions" ON public.influencer_commissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.influencer_links l
    WHERE l.id = link_id AND l.owner_user_id = auth.uid()
  ));

-- 2) Payouts table
CREATE TABLE IF NOT EXISTS public.influencer_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.influencer_links(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  method text NOT NULL CHECK (method IN ('cashapp','venmo','paypal','zelle','other')),
  reference text,
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_influencer_payouts_link ON public.influencer_payouts(link_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.influencer_payouts TO authenticated;
GRANT ALL ON public.influencer_payouts TO service_role;

ALTER TABLE public.influencer_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payouts" ON public.influencer_payouts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Owners read their payouts" ON public.influencer_payouts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.influencer_links l
    WHERE l.id = link_id AND l.owner_user_id = auth.uid()
  ));

CREATE TRIGGER trg_influencer_payouts_updated_at
  BEFORE UPDATE ON public.influencer_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Tie commissions to a payout batch
ALTER TABLE public.influencer_commissions
  ADD COLUMN IF NOT EXISTS payout_id uuid REFERENCES public.influencer_payouts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_influencer_commissions_payout ON public.influencer_commissions(payout_id);

-- 4) RPC: mark a batch of accrued commissions as paid (admin only)
CREATE OR REPLACE FUNCTION public.mark_influencer_commissions_paid(
  _link_id uuid,
  _commission_ids uuid[],
  _method text,
  _reference text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _paid_at timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payout_id uuid;
  v_total int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF _method NOT IN ('cashapp','venmo','paypal','zelle','other') THEN
    RAISE EXCEPTION 'Invalid payout method';
  END IF;
  IF _commission_ids IS NULL OR array_length(_commission_ids,1) IS NULL THEN
    RAISE EXCEPTION 'No commissions selected';
  END IF;

  SELECT COALESCE(SUM(amount_cents),0) INTO v_total
  FROM public.influencer_commissions
  WHERE id = ANY(_commission_ids)
    AND link_id = _link_id
    AND status = 'accrued';

  IF v_total = 0 THEN
    RAISE EXCEPTION 'Selected commissions are not accrued or do not belong to this link';
  END IF;

  INSERT INTO public.influencer_payouts (link_id, amount_cents, method, reference, notes, paid_at, created_by)
  VALUES (_link_id, v_total, _method, _reference, _notes, COALESCE(_paid_at, now()), auth.uid())
  RETURNING id INTO v_payout_id;

  UPDATE public.influencer_commissions
     SET status = 'paid', payout_id = v_payout_id, updated_at = now()
   WHERE id = ANY(_commission_ids)
     AND link_id = _link_id
     AND status = 'accrued';

  RETURN v_payout_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_influencer_commissions_paid(uuid, uuid[], text, text, text, timestamptz) TO authenticated;
