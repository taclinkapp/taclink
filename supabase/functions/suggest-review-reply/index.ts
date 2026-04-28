import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { rating, comment, courseTitle, instructorName, tone } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const ratingNum = Math.max(1, Math.min(5, Number(rating) || 5));
    const safeTone = ["friendly", "professional", "apologetic"].includes(tone)
      ? tone
      : ratingNum >= 4
        ? "friendly"
        : "apologetic";

    const system = `You are an assistant that drafts short, warm, professional replies from a firearms training instructor to a student review.

Rules:
- 2-3 sentences max, under 60 words.
- Plain text only (no markdown, no emojis unless the review uses them).
- Address the student directly. Never invent specific facts (names, dates, future discounts).
- For 4-5 star reviews: thank them sincerely and invite them back.
- For 1-3 star reviews: acknowledge their concern, take responsibility, invite them to message you to make it right. Never argue.
- Never share contact info, phone numbers, emails, or external links. All follow-up must stay on the platform.
- Tone: ${safeTone}.`;

    const user = `Course: ${courseTitle || "(unspecified)"}
Instructor: ${instructorName || "the instructor"}
Star rating: ${ratingNum}/5
Review text: ${comment ? `"${comment}"` : "(no comment provided)"}

Write a single reply.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit reached. Try again in a minute." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in workspace settings." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim() ?? "";

    return new Response(JSON.stringify({ reply: text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-review-reply error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
