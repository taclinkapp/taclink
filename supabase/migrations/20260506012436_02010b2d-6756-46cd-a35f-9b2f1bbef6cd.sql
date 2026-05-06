CREATE POLICY "Users can view their own test account row"
ON public.test_accounts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());