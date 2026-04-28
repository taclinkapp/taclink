// AI fee-insights for instructors.
// Pulls every booking_fees row for the calling instructor (last 30 days),
// computes the totals deterministically (so numbers are always exact),
// then asks the AI to produce a short plain-English payout summary
// + a one-sentence outlook. RLS scopes the rows to the caller automatically.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // RLS restricts to the instructor's own rows
    const { data: fees, error } = await supabase
      .from("booking_fees")
      .select("course_price_cents, platform_fee_cents, instructor_deposit_cents, due_in_person_cents, online_total_cents, created_at")
      .eq("instructor_id", user.id)
      .gte("created_at", since);

    if (error) throw error;

    const rows = fees ?? [];
    const totals = rows.reduce(
      (a, r) => ({
        bookings: a.bookings + 1,
        gross: a.gross + (r.course_price_cents ?? 0),
        platform: a.platform + (r.platform_fee_cents ?? 0),
        deposits_online: a.deposits_online + (r.instructor_deposit_cents ?? 0),
        due_in_person: a.due_in_person + (r.due_in_person_cents ?? 0),
      }),
      { bookings: 0, gross: 0, platform: 0, deposits_online: 0, due_in_person: 0 },
    );
    const instructor_total = totals.deposits_online + totals.due_in_person;

    // No bookings yet → return clean zero state without burning AI credits
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({
          totals,
          instructor_total,
          summary: "No bookings in the last 30 days yet. Once students book, you'll see your $25 platform fee, 10% online deposit, and 90% in-person balance tracked here.",
          outlook: "Publish a course and share it with your network to start receiving bookings.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
    const userMsg = `Last 30 days payout snapshot for this instructor:
- Bookings: ${totals.bookings}
- Gross course value: ${fmt(totals.gross)}
- Platform fee paid by students to the app: ${fmt(totals.platform)} ($25 per booking)
- Instructor deposit (10%) charged online to students: ${fmt(totals.deposits_online)}
- Due to instructor IN PERSON (90% balance): ${fmt(totals.due_in_person)}
- Total instructor earnings (online + in person): ${fmt(instructor_total)}

Write a concise 2-3 sentence plain-English summary an instructor can read at a glance. Then a one-sentence forward-looking "outlook" with one practical tip.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You write short, friendly, accurate payout summaries for firearms-training instructors. Never invent numbers. Always remind the instructor that the in-person balance is collected from the student at the course." },
          { role: "user", content: userMsg },
        ],
        tools: [{
          type: "function",
          function: {
            name: "report_payouts",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string" },
                outlook: { type: "string" },
              },
              required: ["summary", "outlook"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_payouts" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway ${resp.status}`);
    }

    const data = await resp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { summary: "", outlook: "" };

    return new Response(
      JSON.stringify({ totals, instructor_total, ...parsed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("fee-insights error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
