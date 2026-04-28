// Course AI helper: generates field suggestions and waiver/disclaimer drafts.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'google/gemini-3-flash-preview';

interface Body {
  action: 'suggest_field' | 'generate_waiver';
  field?: 'title' | 'description' | 'capacity' | 'price';
  course: {
    title?: string;
    category?: string;
    description?: string;
    duration_minutes?: number;
    city?: string;
    state?: string;
    capacity?: number | string;
    price?: number | string;
  };
}

const fieldSystemPrompt = (field: string) => `You are an expert firearms / tactical training course copywriter helping an instructor fill out their course listing. The platform is for U.S. self-defense, firearms, combatives, medical, and similar tactical training. Be concrete, professional, and avoid contact info, URLs, phone numbers, emails, or social handles.

Return ONLY the value for the "${field}" field, no extra commentary, no quotes, no markdown headings.

Field-specific rules:
- title: 4-9 words, action-oriented, include skill level if obvious. No emojis.
- description: 80-160 words, 2-3 short paragraphs. Cover: what students will learn, prerequisites, what to bring, who it's for. No contact info.
- capacity: a single integer between 4 and 16 appropriate for the course type and duration.
- price: a single integer USD amount appropriate for the course type, duration, and U.S. market (typical range $75-$450). No dollar sign.`;

const waiverSystemPrompt = `You are drafting a Liability Waiver, Release, and Assumption of Risk for a firearms / tactical training course. The instructor will review and edit before students sign.

Output a clear, plain-English waiver in MARKDOWN with these sections:
1. **Assumption of Risk** — list the specific risks of THIS course type (firearms handling, live fire, physical contact, etc.)
2. **Release of Liability** — release the instructor and platform from claims arising from inherent risks
3. **Medical & Physical Fitness Acknowledgment** — student attests they are physically able and disclose conditions
4. **Safety Rules Acknowledgment** — agree to follow all instructor safety directions; intoxication = immediate dismissal
5. **Media Release** (brief, opt-out implied)
6. **Governing Law** — placeholder for state
7. **Signature Block** — leaves space for typed full name and date (these will be added by the e-sign system)

Tailor the risks and safety rules to the course category. Keep total length around 350-550 words. Use second person ("I"). Do NOT include actual signature lines — the platform handles that. End with a clear acknowledgment paragraph beginning "By signing below, I acknowledge...".

Add a brief italicized footer: *This document was AI-generated as a starting draft. The instructor is responsible for reviewing it with qualified counsel before use.*`;

const buildUserPrompt = (body: Body): string => {
  const c = body.course || {};
  const lines = [
    `Course category: ${c.category || 'unspecified'}`,
    c.title && `Current title: ${c.title}`,
    c.description && `Current description: ${c.description.slice(0, 800)}`,
    c.duration_minutes && `Duration: ${c.duration_minutes} minutes`,
    (c.city || c.state) && `Location: ${[c.city, c.state].filter(Boolean).join(', ')}`,
    c.capacity && `Capacity: ${c.capacity}`,
    c.price && `Price (USD): ${c.price}`,
  ].filter(Boolean);
  return lines.join('\n');
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

    const body = (await req.json()) as Body;
    if (!body || !body.action) {
      return new Response(JSON.stringify({ error: 'action is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let systemPrompt: string;
    if (body.action === 'suggest_field') {
      if (!body.field) {
        return new Response(JSON.stringify({ error: 'field is required for suggest_field' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      systemPrompt = fieldSystemPrompt(body.field);
    } else if (body.action === 'generate_waiver') {
      systemPrompt = waiverSystemPrompt;
    } else {
      return new Response(JSON.stringify({ error: 'unknown action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userPrompt = buildUserPrompt(body);

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt || 'No additional context provided.' },
        ],
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: 'AI credits exhausted. Add credits in workspace settings.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error('AI gateway error:', resp.status, t);
      return new Response(JSON.stringify({ error: `AI gateway error (${resp.status})` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content?.trim() ?? '';
    return new Response(JSON.stringify({ result: content, model: MODEL }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('course-ai error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
