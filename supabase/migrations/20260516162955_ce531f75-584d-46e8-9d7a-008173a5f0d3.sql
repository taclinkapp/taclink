CREATE OR REPLACE FUNCTION public.get_public_founder_badge(_user_id uuid)
RETURNS TABLE (user_id uuid, founder_rank int, founder_status public.founder_status)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fi.user_id, fi.founder_rank, fi.founder_status
  FROM public.founding_instructors fi
  WHERE fi.user_id = _user_id
    AND fi.founder_status IN ('active'::public.founder_status, 'pending_prelaunch'::public.founder_status)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_founder_badge(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_founder_badges(_user_ids uuid[])
RETURNS TABLE (user_id uuid, founder_rank int, founder_status public.founder_status)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fi.user_id, fi.founder_rank, fi.founder_status
  FROM public.founding_instructors fi
  WHERE fi.user_id = ANY(_user_ids)
    AND fi.founder_status IN ('active'::public.founder_status, 'pending_prelaunch'::public.founder_status);
$$;

GRANT EXECUTE ON FUNCTION public.get_public_founder_badges(uuid[]) TO anon, authenticated;