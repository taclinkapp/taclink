// Cron-invoked: hard-deletes auth users whose grace period elapsed.
// Profiles row cascades via FK ON DELETE CASCADE.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Auth: cron secret only. This function hard-deletes auth users, so it must
  // never be callable from the public internet without proof of the platform
  // cron identity.
  const expectedSecret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret');
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: due, error } = await admin
    .from('account_deletion_requests')
    .select('id, user_id, scheduled_for')
    .is('cancelled_at', null)
    .is('processed_at', null)
    .lte('scheduled_for', new Date().toISOString())
    .limit(100);

  if (error) {
    console.error('process-account-deletions select error', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: Array<{ user_id: string; ok: boolean; error?: string }> = [];
  for (const row of due ?? []) {
    try {
      const { error: delErr } = await admin.auth.admin.deleteUser(row.user_id);
      if (delErr && !/not found/i.test(delErr.message)) {
        results.push({ user_id: row.user_id, ok: false, error: delErr.message });
        continue;
      }
      await admin
        .from('account_deletion_requests')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', row.id);
      results.push({ user_id: row.user_id, ok: true });
    } catch (e) {
      results.push({ user_id: row.user_id, ok: false, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
