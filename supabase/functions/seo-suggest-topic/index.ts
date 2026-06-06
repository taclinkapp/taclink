// seo-suggest-topic — given a rough topic, return AI-search-optimized
// title + primary keyword + secondary keywords + question variants
// (the patterns ChatGPT/Perplexity/Google AI Overviews actually surface).
// Admin-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are an SEO + AI-search (GEO/AEO) strategist for TacLink (https://taclink.app), a marketplace connecting students with verified tactical, firearms, and self-defense instructors across North America.

You will be given a rough topic. Your job is to return article angle suggestions optimized for how LLM-based search engines (ChatGPT search, Perplexity, Google AI Overviews, Gemini, Claude) actually retrieve and cite content in 2026.

Apply these AI-search patterns:
- Title should be a complete, specific answer-style phrase (not vague). Prefer "How to ...", "Best ... for ...", "... vs ...", "What ... need to know", or year-tagged listicles when timely.
- Title length 45-65 chars. Front-load the primary keyword.
- Primary keyword: 2-5 words, the exact phrase a serious student would type or speak. Lowercase. Include geo modifier only if the topic clearly localizes.
- Secondary keywords: 4-6 supporting phrases — long-tail, conversational, and question-shaped because LLM retrievers favor those.
- Question variants: 3-5 natural-language questions a user would actually ask an AI assistant about this topic. These should match "People Also Ask" / AI-Overview query patterns.
- Angle: one sentence describing the unique angle this article should take so it gets cited (specific, experience-based, not generic).

Return THREE distinct suggestions so the editor can pick one. Different angles, not paraphrases of the same idea.

Return ONLY a JSON object (no markdown, no commentary) with this exact shape:
{
  "suggestions": [
    {
      "title": "string, 45-65 chars",
      "primary_keyword": "string, 2-5 words, lowercase",
      "secondary_keywords": ["string", "string", "..."],
      "questions": ["string?", "string?", "..."],
      "angle": "one sentence"
    },
    { ... }, { ... }
  ]
}`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Admin required" }, 403);

    const body = await req.json().catch(() => ({}));
    const topic: string = (body.topic ?? "").toString().trim();
    const location: string | undefined = body.location?.toString().trim() || undefined;
    const notes: string | undefined = body.notes?.toString().trim() || undefined;

    if (!topic) return json({ error: "topic is required" }, 400);

    const userPrompt = [
      `Topic: ${topic}`,
      location ? `Geographic focus: ${location}` : null,
      notes ? `Extra context: ${notes}` : null,
      "",
      "Return the JSON object now.",
    ].filter(Boolean).join("\n");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      if (aiRes.status === 429) return json({ error: "Rate limit hit. Try again shortly." }, 429);
      if (aiRes.status === 402) return json({ error: "Lovable AI credits exhausted." }, 402);
      return json({ error: "AI suggestion failed" }, 500);
    }

    const aiJson = await aiRes.json();
    const raw = aiJson.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(cleaned);
    }

    const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
    return json({ suggestions });
  } catch (e) {
    console.error("seo-suggest-topic error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
