
CREATE OR REPLACE FUNCTION public.enforce_influencer_owner_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can change anything
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Non-admin owners may only modify payout-related fields + notes.
  -- Reject changes to every other column.
  IF NEW.slug IS DISTINCT FROM OLD.slug
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
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
     OR NEW.access_pin IS DISTINCT FROM OLD.access_pin
  THEN
    RAISE EXCEPTION 'Owners can only update payout_method, payout_handle, and payout_notes';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_influencer_owner_update_scope ON public.influencer_links;
CREATE TRIGGER trg_enforce_influencer_owner_update_scope
BEFORE UPDATE ON public.influencer_links
FOR EACH ROW
EXECUTE FUNCTION public.enforce_influencer_owner_update_scope();
