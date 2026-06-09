// Generates an SEO blog article draft via Lovable AI Gateway.
// Admin-only: requires the caller to have role 'admin' in user_roles.
// Service-role callers (e.g. seo-auto-publish cron) bypass the admin check
// by sending header `x-internal-key` matching SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { buildResearchContext, countWords, MIN_ARTICLE_WORDS } from "../_shared/taclinkKnowledgeBase.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are an SEO content writer for TacLink (https://taclink.app), a platform that connects students with verified tactical, firearms, and self-defense instructors across North America.

Voice: confident, practical, respectful of the discipline. No hype, no fluff, no purple prose. Write the way a serious instructor would talk to a serious student.

HARD WORD-COUNT FLOOR: Every article MUST be at least 1500 words of substantive prose (target 1500-2200). Articles under 1500 words will be REJECTED and regenerated. Hit the floor by adding depth — concrete examples, step-by-step walkthroughs, scenario breakdowns, gear specifics, common mistakes — NOT by padding with filler sentences, repetition, or restating the intro.

Every article must:
- Be at least 1500 words (1500-2200 target).
- Open with a 1-2 sentence hook, NOT a heading. The hook MUST mention TacLink by name in a natural way (e.g. "At TacLink, we...", "We built TacLink because...", or "TacLink connects students with...").
- Use H2 (##) and H3 (###) headings to structure the body. Never use H1.
- Include a mid-article CTA callout (a single short blockquote line) AFTER the first or second H2, similar to: "> **Find a TacLink-vetted instructor near you** — [browse verified instructors](https://taclink.app/student/discover)." Vary the wording per article but always link to a TacLink URL.
- Include a "How TacLink helps" section near the end with a contextual link to https://taclink.app/student/discover (browse instructors) or another relevant TacLink page. Make it natural, not salesy. Reference TacLink by name 3-5 times total across the article.
- End with a short FAQ section (3-5 questions) using H3 (###) per question.
- After the FAQ, add a final "## About TacLink" section: one short paragraph describing TacLink as the platform connecting students with credential-verified firearms, tactical, and self-defense instructors across North America, with a link to https://taclink.app.
- Target the supplied keyword without stuffing. Use it in the title, first 100 words, one H2, and naturally throughout.

IMAGES & GIFs: If an "Available media" list is provided, embed 2-4 of the MOST relevant items (photos or animated GIFs) at natural break points (after the intro, between H2 sections, never inside the FAQ). Use the item's provided alt_text verbatim. Only embed media that genuinely fits the surrounding paragraph — do not force-fit. If nothing fits, embed none.

For EACH embedded item, output it as a TWO-LINE block in this exact format (separated by a blank line above and below):

*Visual N — {short context label}: {one short sentence describing what the reader sees}*

![alt text verbatim](url)

Where N is a sequential number starting at 1 (Visual 1, Visual 2, ...). The italic caption line goes ABOVE the image. Keep the caption under 140 chars. Do not wrap the image in a blockquote or list. In the returned JSON, list the URLs you used in "used_image_urls".

Return ONLY a JSON object (no markdown fences, no commentary) with this exact shape:
{
  "title": "string, max 65 chars, include keyword",
  "slug": "kebab-case-string, max 60 chars, no stopwords",
  "excerpt": "string, 140-180 chars, compelling summary",
  "meta_description": "string, 140-158 chars, optimized for SERP click-through",
  "keywords": ["primary keyword", "secondary keyword", "..."],
  "body_markdown": "the full article in markdown",
  "used_image_urls": ["url1", "url2"]
}`;

const publicBlogMediaUrl = (supabaseUrl: string, path: string) =>
  `${supabaseUrl}/functions/v1/public-blog-media?path=${encodeURIComponent(path)}`;

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

    // Two paths in: admin user (with their JWT) OR internal service-role
    // call from seo-auto-publish cron (with x-internal-key header).
    const internalKey = req.headers.get("x-internal-key") ?? "";
    const isInternal = internalKey && internalKey === SERVICE_ROLE_KEY;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    let callerUserId: string | null = null;

    if (!isInternal) {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader) return jsonResponse({ error: "Missing auth" }, 401);
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401);
      const { data: roleRow } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleRow) return jsonResponse({ error: "Admin required" }, 403);
      callerUserId = userData.user.id;
    }


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

    // --- Media Library: pick relevant high-scoring images for the AI to embed ---
    const MEDIA_MIN_SCORE = 60;
    const MEDIA_POOL_SIZE = 8;
    const keywordTokens = [
      target_keyword,
      title,
      location,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4);

    const mediaPool: Array<{ url: string; alt: string; desc: string; id: string }> = [];
    try {
      const { data: candidates } = await admin
        .from("media_assets")
        .select("id, storage_path, public_url, alt_text, ai_description, seo_score, tags, category")
        .gte("seo_score", MEDIA_MIN_SCORE)
        .order("seo_score", { ascending: false })
        .limit(100);

      const scored = (candidates ?? [])
        .map((a: any) => {
          const hay = [
            a.alt_text ?? "",
            a.ai_description ?? "",
            a.category ?? "",
            (a.tags ?? []).join(" "),
          ]
            .join(" ")
            .toLowerCase();
          const matches = keywordTokens.reduce(
            (n, tok) => (hay.includes(tok) ? n + 1 : n),
            0,
          );
          return { a, matches };
        })
        .filter((x) => x.matches > 0)
        .sort(
          (x, y) =>
            y.matches - x.matches || (y.a.seo_score ?? 0) - (x.a.seo_score ?? 0),
        )
        .slice(0, MEDIA_POOL_SIZE);

      for (const { a } of scored) {
        const url = a.public_url?.startsWith("http")
          ? a.public_url
          : publicBlogMediaUrl(SUPABASE_URL, a.storage_path);
        mediaPool.push({
          id: a.id,
          url,
          alt: a.alt_text ?? "",
          desc: a.ai_description ?? "",
        });
      }
    } catch (e) {
      console.error("media pool query failed", e);
    }

    const mediaBlock = mediaPool.length
      ? [
          "",
          "Available media (embed 2-4 that genuinely fit; use the alt text verbatim):",
          ...mediaPool.map(
            (m, i) =>
              `${i + 1}. url: ${m.url}\n   alt: ${m.alt}\n   about: ${m.desc}`,
          ),
        ].join("\n")
      : "";

    const kbContext = buildResearchContext({
      topic: title,
      target_keyword,
      location,
    });

    const baseUserPrompt = [
      kbContext,
      "",
      notes ? `Additional notes from operator: ${notes}` : null,
      mediaBlock || null,
      "",
      `Write the article now. Return ONLY the JSON object as specified. REMEMBER: the body_markdown field must be at least ${MIN_ARTICLE_WORDS} words.`,
    ].filter(Boolean).join("\n");

    const model = "google/gemini-2.5-pro";

    async function callAI(userPrompt: string) {
      return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
          max_tokens: 12000,
        }),
      });
    }

    function parseAi(raw: string): any {
      try {
        return JSON.parse(raw);
      } catch {
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
        return JSON.parse(cleaned);
      }
    }

    let aiRes = await callAI(baseUserPrompt);
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      if (topic_id) await admin.from("seo_topics").update({ status: "failed" }).eq("id", topic_id);
      if (aiRes.status === 429) return jsonResponse({ error: "Rate limit hit. Try again shortly." }, 429);
      if (aiRes.status === 402) return jsonResponse({ error: "Lovable AI credits exhausted. Add credits in workspace settings." }, 402);
      return jsonResponse({ error: "AI generation failed" }, 500);
    }

    let aiJson = await aiRes.json();
    let raw = aiJson.choices?.[0]?.message?.content ?? "";
    let parsed: any = parseAi(raw);

    // Word-count enforcement: ONE retry if under the floor.
    let words = countWords(parsed.body_markdown ?? "");
    if (words < MIN_ARTICLE_WORDS) {
      console.warn(`Article ${words} words — under ${MIN_ARTICLE_WORDS}. Retrying with stronger instruction.`);
      const retryPrompt =
        baseUserPrompt +
        `\n\nIMPORTANT: Your previous draft was ${words} words. That is under the ${MIN_ARTICLE_WORDS}-word minimum. Rewrite it with substantially more depth (concrete examples, walkthroughs, scenario breakdowns, common mistakes, gear specifics) so the final body_markdown is at least ${MIN_ARTICLE_WORDS} words. Do NOT pad with filler.`;
      const retryRes = await callAI(retryPrompt);
      if (retryRes.ok) {
        const retryJson = await retryRes.json();
        const retryRaw = retryJson.choices?.[0]?.message?.content ?? "";
        try {
          const retryParsed = parseAi(retryRaw);
          const retryWords = countWords(retryParsed.body_markdown ?? "");
          if (retryWords > words) {
            parsed = retryParsed;
            words = retryWords;
          }
        } catch (e) {
          console.error("retry parse failed", e);
        }
      }
    }
    const meetsWordFloor = words >= MIN_ARTICLE_WORDS;


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

    // Auto-pick cover image: prefer first embedded image, else top match in pool
    const bodyForCover: string = parsed.body_markdown ?? "";
    const embeddedCover = mediaPool.find((m) => bodyForCover.includes(m.url));
    const coverImageUrl =
      embeddedCover?.url ?? mediaPool[0]?.url ?? null;

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
        cover_image_url: coverImageUrl,
        status: "draft",
        topic_id: topic_id ?? null,
        model,
        created_by: callerUserId,
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

    // Increment usage_count for images actually embedded in the body
    try {
      const body: string = parsed.body_markdown ?? "";
      const used = mediaPool.filter((m) => body.includes(m.url));
      if (used.length) {
        await Promise.all(
          used.map((m) =>
            admin.rpc as any, // no rpc; do raw update via select+update
          ),
        );
        // Simple per-row update (small N)
        for (const m of used) {
          const { data: row } = await admin
            .from("media_assets")
            .select("usage_count")
            .eq("id", m.id)
            .maybeSingle();
          await admin
            .from("media_assets")
            .update({ usage_count: (row?.usage_count ?? 0) + 1 })
            .eq("id", m.id);
        }
      }
    } catch (e) {
      console.error("media usage tracking failed", e);
    }

    return jsonResponse({ article: inserted });
  } catch (e) {
    console.error("seo-generate-article error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
