// Pulls the backlink profile for a domain from the Semrush connector gateway
// and upserts rows into public.backlinks. Admin-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://connector-gateway.lovable.dev/semrush";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function domainOf(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, ""); }
  catch { return u.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]; }
}

// Convert Semrush JSON ({ data: { columnNames, rows } }) into objects.
function toObjects(data: any): Record<string, string>[] {
  const cols: string[] = data?.data?.columnNames ?? data?.columnNames ?? [];
  const rows: any[] = data?.data?.rows ?? data?.rows ?? [];
  return rows.map((r) => {
    const o: Record<string, string> = {};
    cols.forEach((c, i) => { o[c] = String(r?.[i] ?? ""); });
    return o;
  });
}

async function semrushGet(path: string, params: Record<string, string>, keys: { lovable: string; conn: string }) {
  const qs = new URLSearchParams(params).toString();
  const url = `${GATEWAY}${path}?${qs}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${keys.lovable}`,
      "X-Connection-Api-Key": keys.conn,
      "Allow-Limit-Offset": "true",
    },
  });
  const text = await res.text();
  let body: any; try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!res.ok || body?.error) {
    throw new Error(`Semrush ${path} ${res.status}: ${body?.error ?? text.slice(0, 300)}`);
  }
  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
    const SEMRUSH = Deno.env.get("SEMRUSH_API_KEY");
    if (!LOVABLE) return json({ error: "LOVABLE_API_KEY missing" }, 500);
    if (!SEMRUSH) return json({ error: "Semrush connector not linked" }, 500);

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
    const target: string = (body.target ?? "taclink.app").toString().trim();
    const limit: number = Math.min(Math.max(Number(body.limit ?? 100), 10), 500);

    const keys = { lovable: LOVABLE, conn: SEMRUSH };

    // Pull individual backlinks (source page + anchor + nofollow + DA)
    const linksData = await semrushGet("/backlinks/backlinks", {
      target,
      target_type: "root_domain",
      display_limit: String(limit),
      export_columns: "page_ascore,source_url,source_title,target_url,anchor,nofollow,first_seen,last_seen",
    }, keys);
    const links = toObjects(linksData);

    let inserted = 0, updated = 0, skipped = 0;
    for (const r of links) {
      const source_url = r.source_url?.trim();
      const target_url = r.target_url?.trim();
      if (!source_url || !target_url) { skipped++; continue; }
      const isNofollow = r.nofollow === "1" || r.nofollow?.toLowerCase() === "true";
      const da = r.page_ascore ? parseInt(r.page_ascore, 10) : null;
      const first = r.first_seen && /^\d+$/.test(r.first_seen)
        ? new Date(parseInt(r.first_seen, 10) * 1000).toISOString()
        : (r.first_seen ? new Date(r.first_seen).toISOString() : new Date().toISOString());

      const row = {
        source_domain: domainOf(source_url),
        source_url,
        target_url,
        anchor_text: r.anchor || null,
        link_type: isNofollow ? "nofollow" : "dofollow",
        domain_authority: Number.isFinite(da as number) ? da : null,
        first_seen_at: first,
        last_checked_at: new Date().toISOString(),
        status: "active",
        notes: "Synced from Semrush",
      };

      // Upsert by unique source_url
      const { data: existing } = await admin
        .from("backlinks").select("id").eq("source_url", source_url).maybeSingle();
      if (existing) {
        const { error } = await admin.from("backlinks").update({
          source_domain: row.source_domain,
          target_url: row.target_url,
          anchor_text: row.anchor_text,
          link_type: row.link_type,
          domain_authority: row.domain_authority,
          last_checked_at: row.last_checked_at,
          status: row.status,
        }).eq("id", existing.id);
        if (!error) updated++;
      } else {
        const { error } = await admin.from("backlinks").insert(row);
        if (!error) inserted++;
        else console.error("insert", error.message, source_url);
      }
    }

    return json({
      target,
      fetched: links.length,
      inserted,
      updated,
      skipped,
    });
  } catch (e) {
    console.error("seo-backlinks-sync", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
