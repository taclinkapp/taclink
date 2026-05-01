import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

Deno.serve(async () => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const userId = '3a76e334-3d2c-4109-9f6d-634a7720901b';
  const { data, error } = await admin.auth.admin.updateUserById(userId, {
    password: 'Andygp320796503!',
    email_confirm: true,
  });
  return new Response(JSON.stringify({ data, error }), {
    headers: { 'content-type': 'application/json' },
  });
});
