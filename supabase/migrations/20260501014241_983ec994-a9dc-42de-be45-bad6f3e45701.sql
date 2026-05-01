-- Re-seed dev admin role row (was missing, breaking the dev backdoor)
INSERT INTO public.user_roles (user_id, role)
VALUES ('33333333-3333-3333-3333-333333333333', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Also ensure student/instructor rows are present (idempotent safety net)
INSERT INTO public.user_roles (user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'student'),
  ('22222222-2222-2222-2222-222222222222', 'instructor')
ON CONFLICT (user_id, role) DO NOTHING;