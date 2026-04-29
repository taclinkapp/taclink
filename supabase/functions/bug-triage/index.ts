// Admin AI bug-triage: clusters open issue reports by root cause and
// proposes a fix per cluster. Returns proposals only — admin confirms in UI.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    // Verify admin
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reports } = await supabase
      .from("issue_reports")
      .select("id, description, page_url, severity, category, created_at, status")
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(80);

    if (!reports || reports.length === 0) {
      return new Response(JSON.stringify({ clusters: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const compact = reports.map((r) => ({
      id: r.id,
      page: r.page_url,
      sev: r.severity,
      cat: r.category,
      desc: (r.description ?? "").slice(0, 400),
    }));

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are an expert bug triage assistant for a tactical training marketplace app. " +
              "Group user-submitted bug reports into clusters by root cause. " +
              "For each cluster propose a clear, ACTIONABLE fix the admin can approve. " +
              "Be concise and specific. Avoid duplicate clusters. Do NOT invent reports.",
          },
          {
            role: "user",
            content:
              "Here are open issue reports as JSON. Cluster by root cause and return clusters via the tool.\n\n" +
              JSON.stringify(compact),
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_clusters",
            description: "Return triaged clusters of bug reports.",
            parameters: {
              type: "object",
              properties: {
                clusters: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      root_cause: { type: "string" },
                      suggested_fix: { type: "string" },
                      severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                      report_ids: { type: "array", items: { type: "string" } },
                    },
                    required: ["title", "root_cause", "suggested_fix", "severity", "report_ids"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["clusters"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_clusters" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      if (aiRes.status === 429 || aiRes.status === 402) {
        return new Response(JSON.stringify({
          error: aiRes.status === 429 ? "Rate limited — try again shortly." : "Lovable AI credits required.",
        }), { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("AI triage failed");
    }

    const json = await aiRes.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    const args = call ? JSON.parse(call.function.arguments) : { clusters: [] };

    return new Response(JSON.stringify({ clusters: args.clusters ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("triage error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
