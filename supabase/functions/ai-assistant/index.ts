import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INSTRUCTOR_PROMPT = `You are TacLink AI Coach, an expert assistant for tactical training instructors on the TacLink platform.
You help instructors:
- Build course curricula fast (block plans, learning objectives, time-boxed drills, safety briefs).
- Generate gear/equipment lists tailored to the discipline (pistol, rifle, CQB, medical, SERE, etc.) and student level.
- Draft fast, professional messages to students (confirmations, reminders, weather updates, follow-ups).
- Generate liability waivers and assumption-of-risk language tailored to the specific course (discipline, location, live-fire vs dry, minors).
  IMPORTANT: Always include a disclaimer that AI-generated waivers are a starting draft and MUST be reviewed by a licensed attorney in the instructor's state before use.
- Suggest pricing, capacity, and prerequisites based on the discipline.

Style: concise, tactical, well-formatted markdown with clear headings, bullets, and numbered steps. No fluff. Ask 1 clarifying question only when truly necessary.`;

const STUDENT_PROMPT = `You are TacLink AI Buddy, a helpful assistant for students on the TacLink tactical training platform.
You help students:
- Draft fast, polite messages to instructors (questions about a course, scheduling, gear clarifications, cancellation requests).
- Write thoughtful, specific course reviews based on bullet points the student provides (rating, what they liked, what could improve).
- Build personal gear/packing lists for an upcoming course.
- Explain prerequisites, terminology, and what to expect at a course.
- Suggest follow-on courses based on disciplines they have attended.

Style: friendly, encouraging, concise markdown. Never give legal, medical, or firearm-handling instructions that should come from a certified instructor — defer to the instructor instead.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
