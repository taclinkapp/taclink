// AI suggests internal links (courses, discipline pages, state pages) to weave
// into a draft article so blog readers funnel into the app. Admin-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const US_STATES: Array<[string, string]> = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],
  ["CA","California"],["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],
  ["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],
  ["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],
  ["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],
  ["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],
  ["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],
  ["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],
  ["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],
  ["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
  ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],
  ["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],
  ["WI","Wisconsin"],["WY","Wyoming"],["DC","District of Columbia"],
];

const stateSlug = (n: string) => n.toLowerCase().replace(/\s+/g, "-");
const disciplineSlug = (k: string) =>
  k.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM = `You are an SEO internal-linking assistant for TacLink, a marketplace for tactical and firearms instructors.

You are given a blog article (markdown) and a catalog of internal pages (courses, discipline landing pages, state landing pages, and the discover/instructor signup hubs).

Your job: return 4-8 high-quality internal-link suggestions that funnel blog readers into the app WITHOUT being spammy. Each suggestion must:
- Pick an EXISTING phrase already in the article that reads naturally as the anchor (3-7 words, do NOT invent text).
- Match a target page whose topic genuinely fits the surrounding paragraph (no shoehorning state pages into a generic article).
- Prefer specific course pages over generic hubs when the article mentions a specific discipline/state.
- Never link the same anchor twice; never suggest more than one link per paragraph.
- Skip the intro line and the FAQ section.

Return ONLY a JSON object: { "suggestions": [{ "anchor": "...", "target_url": "/path", "target_label": "Course title or page name", "reason": "one short sentence" }] }`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const auth = req.headers.get("Authorization") ?? "";
    if (!auth) return json({ error: "Missing auth" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: roleRow } = await admin
      .from("user_roles").select("role")
      .eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Admin required" }, 403);

    const body = await req.json().catch(() => ({}));
    const article_id: string | undefined = body.article_id;
    let body_markdown: string = body.body_markdown ?? "";
    let target_keyword: string | undefined = body.target_keyword;
    let title: string | undefined = body.title;

    if (article_id) {
      const { data: art } = await admin.from("seo_articles")
        .select("title, body_markdown, target_keyword").eq("id", article_id).maybeSingle();
      if (!art) return json({ error: "Article not found" }, 404);
      body_markdown = body_markdown || art.body_markdown || "";
      title = title || art.title;
      target_keyword = target_keyword || art.target_keyword || undefined;
    }
    if (!body_markdown.trim()) return json({ error: "Empty body" }, 400);

    // Build catalog of internal pages
    const { data: courses } = await admin
      .from("courses")
      .select("id, title, category, city, state")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(80);

    const { data: cats } = await admin
      .from("courses").select("category").eq("status", "published");
    const usedCategories = Array.from(new Set((cats ?? []).map((r: any) => r.category).filter(Boolean)));
    const usedStates = Array.from(new Set((courses ?? []).map((c: any) => c.state).filter(Boolean)));

    const catalog = {
      hubs: [
        { url: "/student/discover", label: "Browse courses (Discover)" },
        { url: "/instructor", label: "Become a TacLink instructor" },
      ],
      disciplines: usedCategories.map((k: string) => ({
        url: `/discipline/${disciplineSlug(k)}`,
        label: `${k} courses on TacLink`,
        category: k,
      })),
      states: US_STATES
        .filter(([code, name]) => usedStates.some((s) => s === name || s === code))
        .map(([_, name]) => ({
          url: `/train/${stateSlug(name)}`,
          label: `Tactical training in ${name}`,
          state: name,
        })),
      courses: (courses ?? []).map((c: any) => ({
        url: `/student/course/${c.id}`,
        label: c.title,
        category: c.category,
        location: [c.city, c.state].filter(Boolean).join(", "),
      })),
    };

    const userPrompt = [
      title ? `Article title: ${title}` : null,
      target_keyword ? `Target keyword: ${target_keyword}` : null,
      "",
      "ARTICLE MARKDOWN:",
      body_markdown.slice(0, 12000),
      "",
      "INTERNAL PAGE CATALOG (JSON):",
      JSON.stringify(catalog),
      "",
      "Return ONLY the JSON object as specified.",
    ].filter(Boolean).join("\n");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI", aiRes.status, t);
      if (aiRes.status === 429) return json({ error: "Rate limit. Try again shortly." }, 429);
      if (aiRes.status === 402) return json({ error: "Lovable AI credits exhausted." }, 402);
      return json({ error: "AI suggestion failed" }, 500);
    }

    const aiJson = await aiRes.json();
    const raw = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(raw); }
    catch {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(cleaned);
    }

    // Filter: anchor must actually exist in body
    const suggestions = (parsed.suggestions ?? []).filter((s: any) =>
      s?.anchor && s?.target_url && body_markdown.includes(s.anchor)
    );

    return json({ suggestions });
  } catch (e) {
    console.error("seo-internal-links", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
