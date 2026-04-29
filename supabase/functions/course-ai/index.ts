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

const COURSE_CATALOG_HINT = `
Use TacLink's official categories and standard course-type names. Categories: Pistol, Rifle, Shotgun, Multi-Platform, Concealed Carry & Legal, Combatives, Tactical, Medical, Security & EP, Law Enforcement, Hunting & Field, Youth & Family, Specialty.
Standard pistol types: Pistol Fundamentals (Beginner), Concealed Carry / CCW Qualification, Defensive Pistol, Pistol Marksmanship & Accuracy, Low-Light / Nighttime Pistol, One-Handed Pistol Techniques, Pistol Malfunction Clearance, Competition Pistol (USPSA / IDPA Prep), Draw Stroke & Holster Work, Force-on-Force Pistol (Simunitions).
Standard rifle types: AR-15 / Carbine Fundamentals, Patrol Rifle Operator, Long-Range Precision Rifle, Designated Marksman (DMR), Low-Light / Night Vision Rifle, Rifle Malfunction Clearance, Home Defense Rifle, Competition Rifle (3-Gun Prep), Suppressor Operations, Vehicle-Based Rifle Tactics.
Standard shotgun types: Shotgun Fundamentals, Defensive Shotgun, Tactical Shotgun Operations, Breaching Fundamentals (Shotgun), Competition Shotgun (3-Gun Prep).
Multi-Platform: Pistol + Carbine Transition, 3-Gun Fundamentals, Low-Light Multi-Platform, Vehicle CQB (Pistol + Rifle).
Concealed Carry & Legal: CCW / CHL / LTC Qualification, Concealed Carry Renewal, Legal Use of Force, Aftermath of a Defensive Shooting, Traveling Armed, Workplace Carry Policies.
Combatives: Combatives Level 1, Combatives Level 2, Ground Fighting & Grappling, Knife Defense, Edged Weapon Offense, Combatives + Pistol Integration, Women's Self-Defense, Active Threat / Ambush Defense.
Tactical: Close Quarters Battle (CQB) — Room Clearing, Building Clearing, Vehicle Tactics, Hostage Rescue Fundamentals, Surveillance Detection & Counter-Surveillance, Tracking & Counter-Tracking, Urban Survival & Evasion, Team Movement & Communication.
Medical: Tactical Combat Casualty Care (TCCC), Stop the Bleed, Tourniquet Application & Wound Packing, Mass Casualty Response, TECC, Wilderness First Aid for Operators, Medical Under Fire.
Security & EP: Executive Protection Fundamentals, Advance Team Operations, Protective Detail Driving, Threat Assessment & Recognition, Dignitary Protection, Armed Security Officer Certification.
Law Enforcement: Active Shooter Response (LE), De-escalation & Use of Force, Patrol Tactics, Traffic Stop Safety, K-9 Handler Support, Interview & Interrogation Techniques.
Hunting & Field: Long-Range Hunting (Precision Rifle), Backcountry Survival, Land Navigation, Hunting Safety Certification, Bowhunting Fundamentals.
Youth & Family: Youth Firearms Safety (NRA Eddie Eagle), Parent & Child Pistol Fundamentals, Teen Self-Defense, Family Home Defense Planning.
Specialty: Sniper / Precision Rifle Advanced, Breaching, Explosive Ordnance Awareness, SERE Fundamentals, Drone Awareness & Counter-UAS, Cyber & Physical Security Integration.
When the field is "title", prefer one of the standard course-type names above when it matches the category and current draft, otherwise produce a tightly-scoped variant in the same naming style.
`;

const fieldSystemPrompt = (field: string) => `You are an expert firearms / tactical training course copywriter helping an instructor fill out their course listing. The platform is for U.S. self-defense, firearms, combatives, medical, and similar tactical training. Be concrete, professional, and avoid contact info, URLs, phone numbers, emails, or social handles.

${COURSE_CATALOG_HINT}

Return ONLY the value for the "${field}" field, no extra commentary, no quotes, no markdown headings.

Field-specific rules:
- title: 4-9 words, action-oriented, include skill level if obvious. No emojis. Prefer a name from the TacLink standard course-type list when it fits.
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
