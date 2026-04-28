-- Auto-grant admin role to taclink@taclinkapp.com on signup
CREATE OR REPLACE FUNCTION public.grant_admin_for_taclink_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF LOWER(NEW.email) = 'taclink@taclinkapp.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_taclink_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_taclink_admin
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.grant_admin_for_taclink_email();

-- Also handle case where the user already exists (idempotent backfill)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE LOWER(email) = 'taclink@taclinkapp.com'
ON CONFLICT (user_id, role) DO NOTHING;