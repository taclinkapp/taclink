// Generates an SEO blog article draft via Lovable AI Gateway.
// Admin-only: requires the caller to have role 'admin' in user_roles.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are an SEO content writer for TacLink (https://taclink.app), a platform that connects students with verified tactical, firearms, and self-defense instructors across North America.

Voice: confident, practical, respectful of the discipline. No hype, no fluff, no purple prose. Write the way a serious instructor would talk to a serious student.

Every article must:
- Be 900-1400 words of genuine, useful content (no padding).
- Open with a 1-2 sentence hook, NOT a heading.
- Use H2 (##) and H3 (###) headings to structure the body. Never use H1.
- Include a "How TacLink helps" section near the end with a contextual link to https://taclink.app/student (browse courses) or relevant page. Make it natural, not salesy.
- End with a short FAQ section (3-5 questions) using H3 (###) per question.
- Target the supplied keyword without stuffing. Use it in the title, first 100 words, one H2, and naturally throughout.

Return ONLY a JSON object (no markdown fences, no commentary) with this exact shape:
{
  "title": "string, max 65 chars, include keyword",
  "slug": "kebab-case-string, max 60 chars, no stopwords",
  "excerpt": "string, 140-180 chars, compelling summary",
  "meta_description": "string, 140-158 chars, optimized for SERP click-through",
  "keywords": ["primary keyword", "secondary keyword", "..."],
  "body_markdown": "the full article in markdown"
}`;

function jsonResponse(body: unknown, status = 200) {
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
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "LOVABLE_API_KEY not configured" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return jsonResponse({ error: "Missing auth" }, 401);

    // Verify caller is admin
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return jsonResponse({ error: "Admin required" }, 403);

    const body = await req.json().catch(() => ({}));
    const topic_id: string | undefined = body.topic_id;
    let title: string | undefined = body.title;
    let target_keyword: string | undefined = body.target_keyword;
    let location: string | undefined = body.location;
    let notes: string | undefined = body.notes;

    if (topic_id) {
      const { data: topic, error: topicErr } = await admin
        .from("seo_topics")
        .select("*")
        .eq("id", topic_id)
        .single();
      if (topicErr || !topic) return jsonResponse({ error: "Topic not found" }, 404);
      title = title ?? topic.title;
      target_keyword = target_keyword ?? topic.target_keyword;
      location = location ?? topic.location;
      notes = notes ?? topic.notes;
      await admin.from("seo_topics").update({ status: "generating" }).eq("id", topic_id);
    }

    if (!title) return jsonResponse({ error: "title or topic_id required" }, 400);

    const userPrompt = [
      `Topic / working title: ${title}`,
      target_keyword ? `Primary keyword: ${target_keyword}` : null,
      location ? `Geographic focus: ${location}` : null,
      notes ? `Additional notes: ${notes}` : null,
      "",
      "Write the article now. Return ONLY the JSON object as specified.",
    ].filter(Boolean).join("\n");

    const model = "google/gemini-2.5-pro";
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
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
      if (topic_id) await admin.from("seo_topics").update({ status: "failed" }).eq("id", topic_id);
      if (aiRes.status === 429) return jsonResponse({ error: "Rate limit hit. Try again shortly." }, 429);
      if (aiRes.status === 402) return jsonResponse({ error: "Lovable AI credits exhausted. Add credits in workspace settings." }, 402);
      return jsonResponse({ error: "AI generation failed" }, 500);
    }

    const aiJson = await aiRes.json();
    const raw = aiJson.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // strip code fences if any
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(cleaned);
    }

    const slugBase = (parsed.slug || parsed.title || title)
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);

    // Ensure unique slug
    let slug = slugBase || `article-${Date.now()}`;
    for (let i = 2; i < 50; i++) {
      const { data: existing } = await admin
        .from("seo_articles").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      slug = `${slugBase}-${i}`;
    }

    const { data: inserted, error: insertErr } = await admin
      .from("seo_articles")
      .insert({
        slug,
        title: parsed.title ?? title,
        excerpt: parsed.excerpt ?? null,
        meta_description: parsed.meta_description ?? parsed.excerpt ?? null,
        body_markdown: parsed.body_markdown ?? "",
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        target_keyword: target_keyword ?? null,
        status: "draft",
        topic_id: topic_id ?? null,
        model,
        created_by: userData.user.id,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("insert error", insertErr);
      if (topic_id) await admin.from("seo_topics").update({ status: "failed" }).eq("id", topic_id);
      return jsonResponse({ error: insertErr.message }, 500);
    }

    if (topic_id) {
      await admin.from("seo_topics")
        .update({ status: "done", article_id: inserted.id })
        .eq("id", topic_id);
    }

    return jsonResponse({ article: inserted });
  } catch (e) {
    console.error("seo-generate-article error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
