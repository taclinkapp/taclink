// ai-weekly-brief — generates a focused "what should I do this week" brief
// for the platform owner. Runs every Monday at 7am via pg_cron.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // AuthN: cron secret OR admin JWT
    const cronSecret = Deno.env.get("CRON_SECRET");
    const provided = req.headers.get("x-cron-secret");
    let authorized = !!cronSecret && provided === cronSecret;
    if (!authorized) {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (authHeader.startsWith("Bearer ")) {
        try {
          const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
            global: { headers: { Authorization: authHeader } },
          });
          const { data: u } = await userClient.auth.getUser();
          const uid = u?.user?.id;
          if (uid) {
            const adminCheck = createClient(SUPABASE_URL, SERVICE_KEY);
            const { data: r } = await adminCheck
              .from("user_roles").select("role")
              .eq("user_id", uid).eq("role", "admin").maybeSingle();
            if (r) authorized = true;
          }
        } catch (_) { /* fall through */ }
      }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Compute week_starting (Monday of current week, UTC)
    const now = new Date();
    const day = now.getUTCDay(); // 0 Sun..6 Sat
    const diffToMon = (day + 6) % 7;
    const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMon));
    const weekStartIso = weekStart.toISOString().split("T")[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

    // Gather metrics
    const [
      pendingActions,
      autoApprovedWk,
      executedWk,
      newSignups,
      newSignupsPrev,
      bookingsWk,
      bookingsWkPrev,
      stuckDeposits,
      openTickets,
      openReports,
      pendingMod,
      dormantInstructors,
    ] = await Promise.all([
      admin.from("ai_actions").select("id, kind, preview, risk_level", { count: "exact" })
        .in("status", ["proposed", "auto_paused"]).limit(20),
      admin.from("ai_actions").select("id", { count: "exact", head: true })
        .eq("auto_approved", true).gte("created_at", sevenDaysAgo),
      admin.from("ai_actions").select("id", { count: "exact", head: true })
        .eq("status", "executed").gte("created_at", sevenDaysAgo),
      admin.from("profiles").select("id", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo),
      admin.from("profiles").select("id", { count: "exact", head: true })
        .gte("created_at", fourteenDaysAgo).lt("created_at", sevenDaysAgo),
      admin.from("bookings").select("id", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo),
      admin.from("bookings").select("id", { count: "exact", head: true })
        .gte("created_at", fourteenDaysAgo).lt("created_at", sevenDaysAgo),
      admin.from("bookings").select("id", { count: "exact", head: true })
        .eq("deposit_status", "awaiting_confirmation")
        .lt("deposit_expires_at", new Date().toISOString()),
      admin.from("support_tickets").select("id", { count: "exact", head: true })
        .eq("status", "open"),
      admin.from("issue_reports").select("id", { count: "exact", head: true })
        .eq("status", "open"),
      admin.from("flagged_content").select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      admin.from("ai_actions").select("id", { count: "exact", head: true })
        .eq("kind", "instructor_nudge").gte("created_at", sevenDaysAgo),
    ]);

    const metrics = {
      pending_decisions: pendingActions.count ?? 0,
      auto_handled_this_week: autoApprovedWk.count ?? 0,
      executed_this_week: executedWk.count ?? 0,
      new_signups_this_week: newSignups.count ?? 0,
      new_signups_prev_week: newSignupsPrev.count ?? 0,
      bookings_this_week: bookingsWk.count ?? 0,
      bookings_prev_week: bookingsWkPrev.count ?? 0,
      stuck_deposits: stuckDeposits.count ?? 0,
      open_support_tickets: openTickets.count ?? 0,
      open_issue_reports: openReports.count ?? 0,
      pending_moderation: pendingMod.count ?? 0,
      dormant_instructors_nudged: dormantInstructors.count ?? 0,
      sample_pending_items: (pendingActions.data ?? []).slice(0, 10).map((a) => ({
        kind: a.kind, preview: a.preview, risk: a.risk_level,
      })),
    };

    // Ask AI to produce a focused action-items brief
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are the TacLink owner's weekly chief-of-staff. Produce a focused brief with EXACTLY 3-5 concrete action items the solo founder should do this week to grow and protect the business. Be opinionated, specific, and prioritize. No fluff.

Return via the brief tool. Each action_item must include: title (short verb-led), why (one sentence), and how (one concrete step).`,
          },
          {
            role: "user",
            content: `This week's metrics:\n${JSON.stringify(metrics, null, 2)}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "brief",
            description: "Weekly CEO brief",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "2-3 sentence headline of the week" },
                action_items: {
                  type: "array",
                  minItems: 3,
                  maxItems: 5,
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      why: { type: "string" },
                      how: { type: "string" },
                      priority: { type: "string", enum: ["high", "medium", "low"] },
                    },
                    required: ["title", "why", "how", "priority"],
                  },
                },
              },
              required: ["summary", "action_items"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "brief" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return json({ error: "ai_gateway_error" }, 500);
    }

    const aiData = await aiResp.json();
    const call = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return json({ error: "no brief returned" }, 500);
    const briefArgs = JSON.parse(call.function.arguments);

    // Upsert brief for this week
    const { data: brief, error: upErr } = await admin
      .from("cockpit_briefs")
      .upsert(
        {
          week_starting: weekStartIso,
          metrics,
          summary: briefArgs.summary,
          action_items: briefArgs.action_items,
        },
        { onConflict: "week_starting" },
      )
      .select()
      .single();

    if (upErr) {
      console.error("brief upsert error", upErr);
      return json({ error: upErr.message }, 500);
    }

    // Email it to all admins
    const { data: admins } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = (admins ?? []).map((r) => r.user_id);

    let emailedCount = 0;
    if (adminIds.length) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, display_name")
        .in("id", adminIds);
      // auth.users for email
      const { data: usersResp } = await admin.auth.admin.listUsers({ perPage: 200 });
      const emailById = new Map<string, string>();
      for (const u of usersResp?.users ?? []) {
        if (u.id && u.email) emailById.set(u.id, u.email);
      }

      for (const uid of adminIds) {
        const email = emailById.get(uid);
        if (!email) continue;
        const profile = profiles?.find((p) => p.id === uid);
        try {
          await admin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "weekly-ceo-brief",
              recipientEmail: email,
              idempotencyKey: `weekly-brief-${weekStartIso}-${uid}`,
              templateData: {
                name: profile?.display_name ?? "there",
                weekStarting: weekStartIso,
                summary: briefArgs.summary,
                actionItems: briefArgs.action_items,
                metrics: {
                  pendingDecisions: metrics.pending_decisions,
                  autoHandled: metrics.auto_handled_this_week,
                  bookingsThisWeek: metrics.bookings_this_week,
                  newSignupsThisWeek: metrics.new_signups_this_week,
                  stuckDeposits: metrics.stuck_deposits,
                  openTickets: metrics.open_support_tickets,
                },
                briefUrl: `${SUPABASE_URL.replace("/rest/v1", "")}/admin/brief`,
              },
            },
          });
          emailedCount++;
        } catch (e) {
          console.error("email send failed for", uid, e);
        }

        // Also drop an in-app notification
        await admin.from("notifications").insert({
          recipient_id: uid,
          type: "weekly_brief",
          title: "Your weekly TacLink brief is ready",
          body: briefArgs.summary?.slice(0, 200) ?? "View your action items for the week.",
          link: "/admin/brief",
        });
      }

      if (emailedCount > 0) {
        await admin
          .from("cockpit_briefs")
          .update({ emailed_at: new Date().toISOString() })
          .eq("id", brief.id);
      }
    }

    return json({ ok: true, brief, emailed: emailedCount });
  } catch (e) {
    console.error("ai-weekly-brief error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
