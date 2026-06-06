import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.searchParams.get("path") ?? "";
  if (!path || path.startsWith("/") || path.includes("..")) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: asset } = await admin
    .from("media_assets")
    .select("id")
    .eq("storage_path", path)
    .maybeSingle();

  if (!asset) return new Response("Not found", { status: 404, headers: corsHeaders });

  if (!path.startsWith("articles/")) {
    const encodedPath = encodeURIComponent(path);
    const { data: publishedUse } = await admin
      .from("seo_articles")
      .select("id")
      .eq("status", "published")
      .or(`cover_image_url.ilike.%${encodedPath}%,body_markdown.ilike.%${encodedPath}%`)
      .limit(1)
      .maybeSingle();

    if (!publishedUse) return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const { data, error } = await admin.storage.from("media-library").createSignedUrl(path, 60 * 60 * 24);
  if (error || !data?.signedUrl) {
    return new Response("Media unavailable", { status: 500, headers: corsHeaders });
  }

  return Response.redirect(data.signedUrl, 302);
});