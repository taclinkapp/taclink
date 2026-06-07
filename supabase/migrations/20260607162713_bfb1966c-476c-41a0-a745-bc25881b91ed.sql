-- Fix 1: Add admin SELECT policy on email_send_log
CREATE POLICY "Admins can read email send log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix 2: Add admin SELECT policy on suppressed_emails
CREATE POLICY "Admins can read suppressed emails"
ON public.suppressed_emails
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix 3: Prevent owners from modifying access_pin on their influencer_links via trigger
CREATE OR REPLACE FUNCTION public.prevent_influencer_access_pin_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins (or service role bypassing RLS) may change access_pin
  IF NEW.access_pin IS DISTINCT FROM OLD.access_pin THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'access_pin cannot be modified by link owners';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_influencer_access_pin_change_trg ON public.influencer_links;
CREATE TRIGGER prevent_influencer_access_pin_change_trg
BEFORE UPDATE ON public.influencer_links
FOR EACH ROW
EXECUTE FUNCTION public.prevent_influencer_access_pin_change();