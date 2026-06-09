// Auto-publish cron worker for the SEO content engine.
// Runs Mon/Wed/Fri 14:00 UTC via pg_cron.
//
// Flow:
//   1. Read platform_settings.seo_auto_publish_enabled. If false, exit.
//   2. Pick the next queued seo_topic (priority DESC, scheduled_for, created_at).
//   3. Call seo-generate-article with x-internal-key (service-role bypass).
//   4. If word_count >= 1500 -> set article status='published'.
//      Else -> leave as draft, mark topic 'needs_review'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Kill switch
    const { data: setting } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "seo_auto_publish_enabled")
      .maybeSingle();
    const enabled = setting?.value === true || setting?.value === "true";
    if (!enabled) {
      return jsonResponse({ skipped: true, reason: "auto-publish disabled" });
    }

    // Pick next ready topic
    const nowIso = new Date().toISOString();
    const { data: topic, error: topicErr } = await admin
      .from("seo_topics")
      .select("id, title, scheduled_for")
      .eq("status", "queued")
      .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (topicErr) {
      console.error("topic query failed", topicErr);
      return jsonResponse({ error: topicErr.message }, 500);
    }
    if (!topic) {
      return jsonResponse({ skipped: true, reason: "no queued topics" });
    }

    // Generate article via the existing function (service-role bypass).
    const genRes = await fetch(`${SUPABASE_URL}/functions/v1/seo-generate-article`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": SERVICE_ROLE_KEY,
        apikey: SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ topic_id: topic.id }),
    });

    if (!genRes.ok) {
      const t = await genRes.text();
      console.error("generate failed", genRes.status, t);
      return jsonResponse({ error: "generation failed", detail: t }, 500);
    }

    const genJson = await genRes.json();
    const article = genJson.article;
    const meetsFloor = !!genJson.meets_word_floor;
    const wordCount = genJson.word_count ?? 0;

    if (!article?.id) {
      return jsonResponse({ error: "no article returned" }, 500);
    }

    if (meetsFloor) {
      await admin
        .from("seo_articles")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
        })
        .eq("id", article.id);
      return jsonResponse({
        published: true,
        topic_id: topic.id,
        article_id: article.id,
        word_count: wordCount,
      });
    } else {
      // Leave as draft; flag the topic for human review.
      await admin
        .from("seo_topics")
        .update({ status: "needs_review" })
        .eq("id", topic.id);
      return jsonResponse({
        published: false,
        reason: "under 1500-word floor",
        topic_id: topic.id,
        article_id: article.id,
        word_count: wordCount,
      });
    }
  } catch (e) {
    console.error("seo-auto-publish error", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});
