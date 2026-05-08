// Validates a subscription plan with Lovable AI and applies it live.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: 'Not authenticated' }, 401);

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return json({ error: 'Admins only' }, 403);

    const body = await req.json();
    const { plan, apply = true, action } = body ?? {};
    if (!plan) return json({ error: 'plan required' }, 400);

    const aiKeyEarly = Deno.env.get('LOVABLE_API_KEY');

    // ── Brainstorm action: returns a list of suggested feature bullets ──
    if (action === 'brainstorm') {
      if (!aiKeyEarly) return json({ error: 'AI is not configured' }, 500);
      const ai = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiKeyEarly}` },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content:
                'You brainstorm subscription plan features for TacLink, a tactical-training marketplace connecting students with firearms / combatives instructors. Return strict JSON: {"features":string[],"rationale":string}. Generate 6-10 SHORT, concrete, benefit-led bullets (max ~8 words each). Avoid duplicates of existing features. Tone: tactical, precise, no marketing fluff. Match the audience (instructor vs student) and price tier.',
            },
            {
              role: 'user',
              content:
                `Plan context:\nname: ${plan.name ?? '(unnamed)'}\naudience: ${plan.audience ?? 'instructor'}\nprice: $${((plan.price_cents ?? 0) / 100).toFixed(2)}/${plan.billing_interval ?? 'month'}\ndescription: ${plan.description ?? '(none)'}\nexisting features:\n${(plan.features ?? []).map((f: string) => `- ${f}`).join('\n') || '(none)'}\n\nBrainstorm new features that would make this tier compelling.`,
            },
          ],
          response_format: { type: 'json_object' },
        }),
      });
      if (!ai.ok) {
        const txt = await ai.text();
        return json({ error: `AI gateway ${ai.status}: ${txt.slice(0, 200)}` }, 500);
      }
      const out = await ai.json();
      let parsed: any = {};
      try { parsed = JSON.parse(out.choices?.[0]?.message?.content ?? '{}'); } catch { /* ignore */ }
      const features = Array.isArray(parsed.features)
        ? parsed.features.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 12)
        : [];
      return json({ features, rationale: parsed.rationale ?? '' });
    }

    if (!plan.name) return json({ error: 'plan.name required' }, 400);

    // Ask Lovable AI to validate + normalize.
    const aiKey = Deno.env.get('LOVABLE_API_KEY');
    let validation: any = { ok: true, issues: [], suggestions: [], normalized: null };

    if (aiKey) {
      const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiKey}` },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content:
                'You validate subscription plans for a tactical-training marketplace. Return strict JSON: {"ok":boolean,"issues":string[],"suggestions":string[],"normalized":{"name":string,"description":string,"features":string[]}}. Flag duplicate/empty/contradictory features, vague pricing, or missing description. Keep tone tactical & concise.',
            },
            { role: 'user', content: `Plan JSON:\n${JSON.stringify(plan, null, 2)}` },
          ],
          response_format: { type: 'json_object' },
        }),
      });
      if (aiResp.ok) {
        const out = await aiResp.json();
        try {
          validation = JSON.parse(out.choices?.[0]?.message?.content ?? '{}');
        } catch {
          validation = { ok: true, issues: ['AI returned non-JSON'], suggestions: [], normalized: null };
        }
      } else {
        validation = { ok: true, issues: [`AI gateway ${aiResp.status}`], suggestions: [], normalized: null };
      }
    }

    if (!apply) return json({ validation });

    const merged = {
      slug: plan.slug,
      name: validation.normalized?.name ?? plan.name,
      description: validation.normalized?.description ?? plan.description ?? null,
      audience: plan.audience ?? 'instructor',
      price_cents: Number(plan.price_cents) || 0,
      currency: plan.currency ?? 'USD',
      billing_interval: plan.billing_interval ?? 'month',
      features: validation.normalized?.features ?? plan.features ?? [],
      highlight: !!plan.highlight,
      sort_order: Number(plan.sort_order) || 0,
      active: plan.active !== false,
      ai_validation: validation,
      ai_validated_at: new Date().toISOString(),
      created_by: user.id,
    };

    let result;
    if (plan.id) {
      result = await supabase.from('subscription_plans').update(merged).eq('id', plan.id).select().single();
    } else {
      result = await supabase.from('subscription_plans').insert(merged).select().single();
    }
    if (result.error) return json({ error: result.error.message, validation }, 400);

    return json({ plan: result.data, validation, applied: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
