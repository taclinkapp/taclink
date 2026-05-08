
-- 1. Auto-grant admin to the backup admin email on signup (alongside the existing taclink@taclinkapp.com rule).
CREATE OR REPLACE FUNCTION public.grant_admin_for_backup_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF LOWER(NEW.email) = 'andygp503@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grant_admin_for_backup_email_trigger ON auth.users;
CREATE TRIGGER grant_admin_for_backup_email_trigger
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_backup_email();

-- 2. If the user already exists right now, promote immediately.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
  FROM auth.users u
 WHERE LOWER(u.email) = 'andygp503@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
