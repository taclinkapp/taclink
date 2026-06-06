// Analyzes a media asset (image/GIF) for SEO using Lovable AI vision.
// Admin-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are an SEO media analyst for TacLink — a platform connecting students with tactical, firearms, and self-defense instructors.

Analyze the supplied image/GIF and rate its SEO value for a TacLink blog article.

Return ONLY a JSON object (no markdown fences) with this exact shape:
{
  "seoScore": <0-100 integer>,
  "altText": "<concise alt text, max 125 chars>",
  "description": "<2-3 sentence description of what this shows>",
  "tags": ["tag1", "tag2", "tag3"],
  "category": "<one of: product-demo | feature-highlight | workflow | dashboard | mobile-view | range-action | classroom | gear>"
}

Scoring (0-100):
- 90-100: Clear, high-quality action showing a real lesson, drill, range scene, instructor-student interaction, or platform workflow with readable text and good composition.
- 70-89: Clearly shows a specific feature or scene but may be cropped or lack context.
- 50-69: Recognizable subject but blurry, dim, or weak composition.
- 30-49: Generic stock-like image without clear value to a tactical training article.
- 0-29: Off-topic, broken, low quality, or unsafe to publish.

Prefer images that show: real training scenes, range/classroom settings, drills, instructor expertise, the TacLink app in use, and mobile responsiveness.`;

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
    const id: string | undefined = body.id;
    if (!id) return jsonResponse({ error: "id required" }, 400);

    const { data: asset, error: assetErr } = await admin
      .from("media_assets")
      .select("*")
      .eq("id", id)
      .single();
    if (assetErr || !asset) return jsonResponse({ error: "Asset not found" }, 404);

    // Use a short-lived signed URL instead of base64 — base64-encoding large
    // GIFs in edge-function memory was causing OOM kills.
    const { data: signed, error: signErr } = await admin.storage
      .from("media-library")
      .createSignedUrl(asset.storage_path, 600);
    if (signErr || !signed?.signedUrl) {
      await admin.from("media_assets").update({ analysis_error: `sign failed: ${signErr?.message}` }).eq("id", id);
      return jsonResponse({ error: `Sign failed: ${signErr?.message}` }, 500);
    }
    const dataUrl = signed.signedUrl;

    // For large GIFs, skip vision (model can't reliably process animated GIFs anyway
    // and signed URLs to large binaries cause AI gateway fetch failures). Score from
    // filename + size heuristics only.
    const isLargeGif = asset.mime_type === "image/gif" && (asset.file_size ?? 0) > 4 * 1024 * 1024;

    let parsed: any = null;
    if (isLargeGif) {
      const name = asset.filename.toLowerCase();
      const guessTags = ["gif", "animation", "demo"];
      parsed = {
        seoScore: 65,
        altText: `Animated demo: ${asset.filename}`,
        description: `Animated GIF (${Math.round((asset.file_size ?? 0) / 1024 / 1024)}MB). Auto-scored — re-score after upload to refine.`,
        tags: guessTags,
        category: name.includes("dashboard") ? "dashboard" : name.includes("mobile") ? "mobile-view" : "workflow",
      };
    } else {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: `Analyze this asset (filename: ${asset.filename}). Return JSON only.` },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        await admin.from("media_assets").update({ analysis_error: `ai ${aiRes.status}: ${errText.slice(0, 500)}` }).eq("id", id);
        return jsonResponse({ error: `AI error ${aiRes.status}`, detail: errText }, 502);
      }

      const aiJson = await aiRes.json();
      const raw: string = aiJson?.choices?.[0]?.message?.content ?? "";
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

      try { parsed = JSON.parse(cleaned); } catch {
        const m = cleaned.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : null;
      }
      if (!parsed) {
        await admin.from("media_assets").update({ analysis_error: "AI returned non-JSON" }).eq("id", id);
        return jsonResponse({ error: "AI returned non-JSON", raw }, 502);
      }
    }

    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.seoScore) || 0)));
    const tags = Array.isArray(parsed.tags) ? parsed.tags.map((t: any) => String(t)).slice(0, 12) : [];

    const { error: updErr } = await admin.from("media_assets").update({
      seo_score: score,
      alt_text: parsed.altText ?? null,
      ai_description: parsed.description ?? null,
      tags,
      category: parsed.category ?? null,
      analyzed_at: new Date().toISOString(),
      analysis_error: null,
    }).eq("id", id);
    if (updErr) return jsonResponse({ error: updErr.message }, 500);

    return jsonResponse({ ok: true, seo_score: score, category: parsed.category, tags });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
