import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are TacLink Admin Copilot — a powerful operations assistant for TacLink platform admins.

You have THREE modes you should fluidly switch between based on what the admin asks:

1) READ-ONLY DIAGNOSTICS & Q&A
   - Use the get_platform_diagnostics tool to answer "how many users / stuck deposits / pending moderation / open tickets / etc." questions.
   - Use search_users / search_courses / get_audit_log to investigate specific cases.
   - Summarize logs, surface anomalies, identify trends.

2) GUIDED ACTIONS (tool-call PROPOSALS)
   - When the admin says things like "suspend user X", "publish course Y", "issue a refund", "toggle the referrals flag off", "update platform fee to $30", "feature this course"…
   - Propose a structured action by calling the matching propose_* tool. The frontend will render a confirmation card and the admin will click "Run" to execute it. NEVER claim an action is done after just proposing — say "I've proposed this action; click Run to confirm".
   - Always include a brief reason in the proposal.

3) BUG TRIAGE
   - Use list_open_issue_reports and list_open_support_tickets to read open bug reports.
   - Cluster related issues, suggest root causes, and draft replies the admin can copy.

Style: tactical, concise markdown. Use tables for lists. Always state the impact of an action before proposing it. If unsure or risky, ask one clarifying question first.`;

const tools = [
  // ---------- Read-only ----------
  {
    type: "function",
    function: {
      name: "get_platform_diagnostics",
      description: "Get a snapshot of platform health: user count, published courses, recent bookings, stuck deposits, pending moderation, open tickets, open issue reports.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "search_users",
      description: "Search profiles by display name (substring, case-insensitive). Returns up to 20 matches with id, display_name, account_status, strike_points, roles.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Substring of display name." } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_courses",
      description: "Search courses by title (substring, case-insensitive). Returns up to 20 matches.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_audit_log",
      description: "Get the most recent admin actions from the audit log.",
      parameters: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_open_issue_reports",
      description: "List open bug/issue reports submitted by users.",
      parameters: { type: "object", properties: { limit: { type: "integer", default: 20 } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_open_support_tickets",
      description: "List open support tickets.",
      parameters: { type: "object", properties: { limit: { type: "integer", default: 20 } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_settings",
      description: "List all platform_settings.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_feature_flags",
      description: "List all feature flags.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  // ---------- Action proposals (NOT executed server-side) ----------
  {
    type: "function",
    function: {
      name: "propose_user_action",
      description: "Propose an action against a user. The admin will confirm in the UI before it runs.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["suspend", "reactivate", "reset_strikes", "grant_admin", "revoke_admin"] },
          user_id: { type: "string" },
          user_label: { type: "string", description: "Human-readable label for the UI (e.g. display name)." },
          reason: { type: "string" },
        },
        required: ["action", "user_id", "reason"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_course_action",
      description: "Propose a course action: publish/unpublish/approve/reject moderation.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["publish", "unpublish", "approve_moderation", "reject_moderation"] },
          course_id: { type: "string" },
          course_label: { type: "string" },
          reason: { type: "string" },
        },
        required: ["action", "course_id", "reason"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_setting_update",
      description: "Propose updating a platform setting (e.g. platform_fee_cents, deposit_window_minutes).",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string" },
          new_value: { description: "JSON value to set (number, string, boolean, etc.)." },
          reason: { type: "string" },
        },
        required: ["key", "new_value", "reason"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_flag_toggle",
      description: "Propose enabling or disabling a feature flag.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string" },
          enabled: { type: "boolean" },
          reason: { type: "string" },
        },
        required: ["key", "enabled", "reason"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_grant_credit",
      description: "Propose granting a free booking credit to a student or a free listing credit to an instructor.",
      parameters: {
        type: "object",
        properties: {
          user_type: { type: "string", enum: ["student", "instructor"] },
          user_id: { type: "string" },
          user_label: { type: "string" },
          note: { type: "string" },
        },
        required: ["user_type", "user_id", "note"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_refund",
      description: "Propose issuing a refund for a booking.",
      parameters: {
        type: "object",
        properties: {
          booking_id: { type: "string" },
          student_id: { type: "string" },
          amount_cents: { type: "integer", minimum: 1 },
          refund_type: { type: "string", enum: ["full", "partial", "platform_fee", "goodwill"] },
          reason: { type: "string" },
          notes: { type: "string" },
        },
        required: ["booking_id", "student_id", "amount_cents", "refund_type", "reason"],
        additionalProperties: false,
      },
    },
  },
];

async function runTool(name: string, args: any, supabase: any) {
  switch (name) {
    case "get_platform_diagnostics": {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const [users, courses, bookings, stuck, pendingMod, openTickets, openReports] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("status", "published"),
        supabase.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("bookings").select("id", { count: "exact", head: true })
          .eq("deposit_status", "awaiting_confirmation")
          .lt("deposit_expires_at", new Date().toISOString()),
        supabase.from("flagged_content").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("issue_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      return {
        total_users: users.count ?? 0,
        published_courses: courses.count ?? 0,
        bookings_last_7d: bookings.count ?? 0,
        stuck_deposits: stuck.count ?? 0,
        pending_moderation: pendingMod.count ?? 0,
        open_support_tickets: openTickets.count ?? 0,
        open_issue_reports: openReports.count ?? 0,
      };
    }
    case "search_users": {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, account_status, strike_points")
        .ilike("display_name", `%${args.query}%`)
        .limit(20);
      const ids = (data ?? []).map((p: any) => p.id);
      const { data: roles } = ids.length
        ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids)
        : { data: [] as any[] };
      const map = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = map.get(r.user_id) ?? [];
        arr.push(r.role);
        map.set(r.user_id, arr);
      });
      return (data ?? []).map((p: any) => ({ ...p, roles: map.get(p.id) ?? [] }));
    }
    case "search_courses": {
      const { data } = await supabase
        .from("courses")
        .select("id, title, status, moderation_status, instructor_id, price_cents, starts_at")
        .ilike("title", `%${args.query}%`)
        .limit(20);
      return data ?? [];
    }
    case "get_audit_log": {
      const { data } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(args.limit ?? 20);
      return data ?? [];
    }
    case "list_open_issue_reports": {
      const { data } = await supabase
        .from("issue_reports")
        .select("id, category, severity, page_url, description, reporter_email, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(args.limit ?? 20);
      return data ?? [];
    }
    case "list_open_support_tickets": {
      const { data } = await supabase
        .from("support_tickets")
        .select("id, subject, initial_message, user_role, contact_email, created_at, needs_human")
        .eq("status", "open")
        .order("last_message_at", { ascending: false })
        .limit(args.limit ?? 20);
      return data ?? [];
    }
    case "list_settings": {
      const { data } = await supabase.from("platform_settings").select("*").order("category").order("key");
      return data ?? [];
    }
    case "list_feature_flags": {
      const { data } = await supabase.from("feature_flags").select("*").order("key");
      return data ?? [];
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // AuthN: require admin caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Not signed in" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages = [], context } = await req.json();
    const ctxBlock = context?.tab
      ? `\n\nCURRENT ADMIN CONTEXT\n- Active tab: ${context.tab.label ?? context.tab.path}\n- Route: ${context.tab.path}\n- Purpose: ${context.tab.purpose ?? "(unspecified)"}\n\nSCOPE RULE: Focus your assistance, diagnostics, and proposed actions on this tab's domain. If the admin asks something clearly outside this tab, answer briefly and suggest navigating to the relevant tab. Prefer tools and data relevant to this tab first.`
      : "";
    const convo: any[] = [{ role: "system", content: SYSTEM_PROMPT + ctxBlock }, ...messages];

    // Loop: allow up to 4 tool-call rounds
    for (let round = 0; round < 4; round++) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: convo,
          tools,
        }),
      });
      if (!resp.ok) {
        if (resp.status === 429)
          return new Response(JSON.stringify({ error: "Rate limit reached. Try again shortly." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (resp.status === 402)
          return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace Settings." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const t = await resp.text();
        console.error("AI gateway error", resp.status, t);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await resp.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) {
        return new Response(JSON.stringify({ error: "No response" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        // Final answer
        return new Response(JSON.stringify({ content: msg.content ?? "", proposals: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Split tool calls into proposals (returned to client) vs read-only tools (executed server-side)
      const proposals: any[] = [];
      const readOnlyResults: { id: string; name: string; result: any }[] = [];

      for (const tc of toolCalls) {
        const name = tc.function?.name;
        let parsedArgs: any = {};
        try { parsedArgs = JSON.parse(tc.function?.arguments ?? "{}"); } catch {}
        if (name?.startsWith("propose_")) {
          proposals.push({ id: tc.id, name, args: parsedArgs });
        } else {
          const result = await runTool(name, parsedArgs, admin);
          readOnlyResults.push({ id: tc.id, name, result });
        }
      }

      // If the model only proposed actions, return them and stop.
      if (proposals.length > 0 && readOnlyResults.length === 0) {
        return new Response(
          JSON.stringify({ content: msg.content ?? "", proposals }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Otherwise feed read-only results back to the model
      convo.push(msg);
      for (const r of readOnlyResults) {
        convo.push({ role: "tool", tool_call_id: r.id, content: JSON.stringify(r.result) });
      }
      // If proposals existed too, surface them in the final return next round
      if (proposals.length > 0) {
        // Stash proposals in a synthetic message so the model can describe them
        convo.push({
          role: "system",
          content: `The user has been shown ${proposals.length} action proposal card(s) which they will confirm manually. Briefly describe them in your reply.`,
        });
      }
    }

    return new Response(JSON.stringify({ content: "I hit the tool-call iteration limit. Please rephrase.", proposals: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-ai error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
