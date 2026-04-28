// Instructor insights: hybrid local-demand + best-time-to-post.
// Combines real platform signals (recent bookings + course searches in the
// instructor's state/categories) with an AI projection that estimates total
// addressable demand and recommends the optimal post day/time per category.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Body = {
  state?: string | null;
  city?: string | null;
  categories?: string[] | null;
};

const TOOL = {
  type: "function",
  function: {
    name: "report_local_demand",
    description: "Estimate local firearms-training demand and best post times.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string" },
        per_category: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string" },
              projected_monthly_students: { type: "number" },
              demand_level: { type: "string", enum: ["low", "moderate", "high", "very_high"] },
              best_post_day: {
                type: "string",
                enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
              },
              best_post_time_local: { type: "string" },
              rationale: { type: "string" },
            },
            required: [
              "category",
              "projected_monthly_students",
              "demand_level",
              "best_post_day",
              "best_post_time_local",
              "rationale",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "per_category"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const state = (body.state || "").trim();
    const city = (body.city || "").trim();
    const categories = (body.categories || []).filter(Boolean);

    if (!state || categories.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Set your service state and at least one category in your dashboard.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Real platform signal: bookings + courses in state/categories over last 30d
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: localCourses } = await admin
      .from("courses")
      .select("id, category")
      .eq("state", state)
      .in("category", categories);
    const courseIds = (localCourses ?? []).map((c) => c.id);

    let realBookingsByCat: Record<string, number> = {};
    if (courseIds.length > 0) {
      const { data: bks } = await admin
        .from("bookings")
        .select("course_id, booked_at")
        .in("course_id", courseIds)
        .gte("booked_at", since);
      const catMap = new Map((localCourses ?? []).map((c) => [c.id, c.category as string]));
      for (const b of bks ?? []) {
        const cat = catMap.get(b.course_id as string);
        if (!cat) continue;
        realBookingsByCat[cat] = (realBookingsByCat[cat] ?? 0) + 1;
      }
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const userMsg = `Instructor location: ${city ? city + ", " : ""}${state}, USA.
Categories taught: ${categories.join(", ")}.
Real platform bookings last 30 days in this state for these categories: ${
      JSON.stringify(realBookingsByCat)
    }.

Estimate the total addressable monthly demand (students looking) per category in this region by combining:
- the real platform signal above (treat it as a lower bound — platform is still growing)
- US population, gun-ownership rates, and concealed-carry permit density for the state
- typical seasonality for firearms training
Then recommend the single best day-of-week and local time-of-day window to PUBLISH a course in each category to maximize bookings (consider when students browse: weekday evenings, Sunday nights are strong; the post itself should land before the weekly browse spike).

Return concise, realistic numbers — not inflated.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a market analyst for a US firearms-training booking marketplace. Return calibrated, realistic projections — never invent precise numbers, prefer round estimates with clear rationale.",
          },
          { role: "user", content: userMsg },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "report_local_demand" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway ${resp.status}`);
    }

    const data = await resp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { summary: "", per_category: [] };

    return new Response(
      JSON.stringify({
        ...parsed,
        real_signal: realBookingsByCat,
        state,
        city,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("instructor-insights error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
