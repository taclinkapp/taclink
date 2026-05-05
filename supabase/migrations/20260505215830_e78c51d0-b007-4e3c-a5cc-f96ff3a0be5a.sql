
-- Helper: is this user a test account?
CREATE OR REPLACE FUNCTION public.is_test_account(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.test_accounts WHERE user_id = _user_id
  );
$$;

-- Replace the public courses SELECT policy so test-instructor courses
-- are hidden from real users.
DROP POLICY IF EXISTS "Published courses are viewable by everyone" ON public.courses;

CREATE POLICY "Published courses are viewable by everyone"
ON public.courses
FOR SELECT
TO public
USING (
  (
    status = 'published'
    AND (
      -- Real (non-test) instructor → visible to everyone
      NOT public.is_test_account(instructor_id)
      -- Test-instructor course → only visible to other test accounts
      OR public.is_test_account(auth.uid())
    )
  )
  OR auth.uid() = instructor_id
  OR public.has_role(auth.uid(), 'admin')
);
