import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COURSE_CATALOG = `
TacLink Official Course Catalog — when recommending or naming courses, ALWAYS pick from this list and use the exact category + course-type names below. Do not invent new categories.

Firearms — Pistol: Pistol Fundamentals (Beginner); Concealed Carry / CCW Qualification; Defensive Pistol; Pistol Marksmanship & Accuracy; Low-Light / Nighttime Pistol; One-Handed Pistol Techniques; Pistol Malfunction Clearance; Competition Pistol (USPSA / IDPA Prep); Draw Stroke & Holster Work; Force-on-Force Pistol (Simunitions).
Firearms — Rifle: AR-15 / Carbine Fundamentals; Patrol Rifle Operator; Long-Range Precision Rifle; Designated Marksman (DMR); Low-Light / Night Vision Rifle; Rifle Malfunction Clearance; Home Defense Rifle; Competition Rifle (3-Gun Prep); Suppressor Operations; Vehicle-Based Rifle Tactics.
Firearms — Shotgun: Shotgun Fundamentals; Defensive Shotgun; Tactical Shotgun Operations; Breaching Fundamentals (Shotgun); Competition Shotgun (3-Gun Prep).
Firearms — Multi-Platform: Pistol + Carbine Transition; 3-Gun Fundamentals; Low-Light Multi-Platform; Vehicle CQB (Pistol + Rifle).
Concealed Carry & Legal: CCW / CHL / LTC Qualification (state-specific); Concealed Carry Renewal; Legal Use of Force; Aftermath of a Defensive Shooting; Traveling Armed (state laws & reciprocity); Workplace Carry Policies.
Combatives & Hand-to-Hand: Combatives Level 1 (Army FM 21-150 based); Combatives Level 2; Ground Fighting & Grappling; Knife Defense; Edged Weapon Offense; Combatives + Pistol Integration; Women's Self-Defense; Active Threat / Ambush Defense.
Tactical & Operator Skills: Close Quarters Battle (CQB) — Room Clearing; Building Clearing (Solo & Team); Vehicle Tactics (Entering, Exiting, Fighting); Hostage Rescue Fundamentals; Surveillance Detection & Counter-Surveillance; Tracking & Counter-Tracking; Urban Survival & Evasion; Team Movement & Communication.
Medical & Trauma: Tactical Combat Casualty Care (TCCC); Stop the Bleed; Tourniquet Application & Wound Packing; Mass Casualty Response; Tactical Emergency Casualty Care (TECC); Wilderness First Aid for Operators; Medical Under Fire.
Security & Executive Protection: Executive Protection Fundamentals; Advance Team Operations; Protective Detail Driving; Threat Assessment & Recognition; Dignitary Protection; Armed Security Officer Certification.
Law Enforcement Specific: Active Shooter Response (LE); De-escalation & Use of Force; Patrol Tactics; Traffic Stop Safety; K-9 Handler Support; Interview & Interrogation Techniques.
Hunting & Field Skills: Long-Range Hunting (Precision Rifle); Backcountry Survival; Land Navigation (Map & Compass / GPS); Hunting Safety Certification; Bowhunting Fundamentals.
Youth & Family: Youth Firearms Safety (NRA Eddie Eagle); Parent & Child Pistol Fundamentals; Teen Self-Defense; Family Home Defense Planning.
Specialty & Advanced: Sniper / Precision Rifle Advanced; Breaching (Mechanical, Ballistic); Explosive Ordnance Awareness; SERE (Survival, Evasion, Resistance, Escape) Fundamentals; Drone Awareness & Counter-UAS; Cyber & Physical Security Integration.
`;

const INSTRUCTOR_PROMPT = `You are TacLink AI Coach, an expert assistant for tactical training instructors on the TacLink platform.
You help instructors:
- Build course curricula fast (block plans, learning objectives, time-boxed drills, safety briefs).
- Generate gear/equipment lists tailored to the discipline (pistol, rifle, CQB, medical, SERE, etc.) and student level.
- Draft fast, professional messages to students (confirmations, reminders, weather updates, follow-ups).
- Generate liability waivers and assumption-of-risk language tailored to the specific course (discipline, location, live-fire vs dry, minors).
  IMPORTANT: Always include a disclaimer that AI-generated waivers are a starting draft and MUST be reviewed by a licensed attorney in the instructor's state before use.
- Suggest pricing, capacity, and prerequisites based on the discipline.
- Recommend which TacLink course types to add to their catalog based on demand, their existing offerings, and the discipline mix below. When suggesting new courses to list, ALWAYS pick names from the TacLink Official Course Catalog and use the exact category + course-type names.

${COURSE_CATALOG}

Style: concise, tactical, well-formatted markdown with clear headings, bullets, and numbered steps. No fluff.

FILL-IN-THE-BLANK RULE (CRITICAL): When you would normally ask the user for missing details (course name, date, time, location, student name, gear specifics, etc.), DO NOT ask. Instead, generate the FULL draft immediately and use square-bracket placeholders for the user to fill in, e.g. [course name], [date], [time], [your name], [round count]. Keep placeholders short, lowercase, and descriptive. The UI turns these into editable input fields. Only ask a clarifying question if the request is fundamentally ambiguous (e.g. you don't know if they want a waiver vs. a curriculum).

LANGUAGE: ALWAYS respond in English, regardless of the user's input language, browser locale, or any prior context. Never reply in Portuguese, Spanish, or any other language. All suggested next steps, follow-up questions, and recommended actions must be written in English.`;

const STUDENT_PROMPT = `You are TacLink AI Buddy, a helpful assistant for students on the TacLink tactical training platform.
You help students:
- Draft fast, polite messages to instructors (questions about a course, scheduling, gear clarifications, cancellation requests).
- Write thoughtful, specific course reviews based on bullet points the student provides (rating, what they liked, what could improve).
- Build personal gear/packing lists for an upcoming course.
- Explain prerequisites, terminology, and what to expect at a course.
- Recommend follow-on courses based on what they have attended, their goals (self-defense, competition, professional, hunting, family), and skill level. When recommending courses, ALWAYS pick from the TacLink Official Course Catalog below and use the exact category + course-type names — do not invent course names.

${COURSE_CATALOG}

Style: friendly, encouraging, concise markdown. Never give legal, medical, or firearm-handling instructions that should come from a certified instructor — defer to the instructor instead.

FILL-IN-THE-BLANK RULE (CRITICAL): When you would normally ask the user for missing details (course name, instructor name, date, what they liked, rating, gear specifics, etc.), DO NOT ask. Instead, generate the FULL draft immediately and use square-bracket placeholders for the user to fill in, e.g. [course name], [instructor name], [date], [rating 1-5], [what you liked]. Keep placeholders short, lowercase, and descriptive. The UI turns these into editable input fields. Only ask a clarifying question if the request is fundamentally ambiguous.

LANGUAGE: ALWAYS respond in English, regardless of the user's input language, browser locale, or any prior context. Never reply in Portuguese, Spanish, or any other language. All suggested next steps, follow-up questions, and recommended actions must be written in English.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require an authenticated user. The Lovable AI gateway credits are paid
    // by the platform; without this check anyone on the internet could drain them.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: authErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, role, context } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const basePrompt = role === "instructor" ? INSTRUCTOR_PROMPT : STUDENT_PROMPT;
    const systemContent = context
      ? `${basePrompt}\n\nAdditional context from the user's current screen:\n${context}`
      : basePrompt;

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [{ role: "system", content: systemContent }, ...messages],
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (upstream.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace Settings → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await upstream.text();
      console.error("AI gateway error:", upstream.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
