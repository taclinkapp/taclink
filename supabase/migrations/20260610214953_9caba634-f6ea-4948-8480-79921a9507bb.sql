
-- Lock down which columns an influencer link owner can change on their own row.
-- Owners may update payout-related fields only; commission rates, VIP flags,
-- audience, active flag, slug, etc. remain admin-only.

CREATE OR REPLACE FUNCTION public.enforce_influencer_owner_update_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and service_role bypass column restrictions.
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Only the owner reaches this branch (RLS already enforces ownership).
  -- Reject any change outside the allowed payout fields.
  IF NEW.slug IS DISTINCT FROM OLD.slug
     OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
     OR NEW.influencer_name IS DISTINCT FROM OLD.influencer_name
     OR NEW.influencer_email IS DISTINCT FROM OLD.influencer_email
     OR NEW.audience IS DISTINCT FROM OLD.audience
     OR NEW.active IS DISTINCT FROM OLD.active
     OR NEW.is_vip IS DISTINCT FROM OLD.is_vip
     OR NEW.vip_pct IS DISTINCT FROM OLD.vip_pct
     OR NEW.vip_duration_days IS DISTINCT FROM OLD.vip_duration_days
     OR NEW.vip_starts_at IS DISTINCT FROM OLD.vip_starts_at
     OR NEW.commission_pct IS DISTINCT FROM OLD.commission_pct
     OR NEW.first_booking_pct IS DISTINCT FROM OLD.first_booking_pct
     OR NEW.recurring_pct IS DISTINCT FROM OLD.recurring_pct
     OR NEW.recurring_window_days IS DISTINCT FROM OLD.recurring_window_days
     OR NEW.access_pin IS DISTINCT FROM OLD.access_pin
  THEN
    RAISE EXCEPTION 'Owners may only update payout_method, payout_handle, and payout_notes on their influencer link';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_enforce_influencer_owner_update_columns ON public.influencer_links;
CREATE TRIGGER tg_enforce_influencer_owner_update_columns
BEFORE UPDATE ON public.influencer_links
FOR EACH ROW EXECUTE FUNCTION public.enforce_influencer_owner_update_columns();
