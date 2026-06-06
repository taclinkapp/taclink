// AI moderation edge function.
// Scans text and/or images for: sexual/explicit content, contact-info sharing,
// off-platform payment attempts, harassment, and violence. Uses Lovable AI
// Gateway with structured tool-calling output. On a flagged result it:
//   1. Inserts a row into `flagged_content` for admin review
//   2. Updates the source row's `moderation_status` to 'flagged' so the UI
//      can hide it from regular users until reviewed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ContentType =
  | "message"
  | "course_text"
  | "course_image"
  | "review_image";

type Body = {
  contentType: ContentType;
  contentId?: string | null;
  text?: string | null;
  imageUrl?: string | null;
  conversationId?: string | null;
  courseId?: string | null;
  authorId?: string | null;
  authorRole?: string | null;
};

const TOOL = {
  type: "function",
  function: {
    name: "report_moderation",
    description:
      "Report whether the content violates platform safety policies.",
    parameters: {
      type: "object",
      properties: {
        flagged: { type: "boolean" },
        category: {
          type: "string",
          enum: [
            "sexual",
            "violence",
            "contact_share",
            "off_platform",
            "harassment",
            "other",
            "none",
          ],
        },
        severity: { type: "string", enum: ["low", "medium", "high", "none"] },
        reason: { type: "string" },
      },
      required: ["flagged", "category", "severity", "reason"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `You are a focused content-safety classifier for TacLink, a firearms-training booking platform.

Your ONLY job is to detect attempts by students or instructors to break the platform-communication agreement by moving the conversation OFF TacLink. This applies to:
- direct messages between students and instructors
- course listings created by instructors (title, description, cover photo) — instructors must NOT use course content to advertise personal contact info or steer students off-platform

Flag content ONLY if it contains:
- "contact_share": phone numbers, email addresses, social media handles (Instagram, Snapchat, WhatsApp, Telegram, Signal, Facebook, TikTok, Discord, YouTube, etc.), or external URLs/links to personal sites/booking pages, shown with the apparent intent of continuing communication or booking off-platform. For images, flag if visible text/overlays/business cards/QR codes display contact info or external handles.
- "off_platform": explicit suggestions to "text me", "call me", "DM me on <app>", "book directly with me", "contact me outside the app", arrange training, payment, or scheduling outside the TacLink booking flow.

Do NOT flag:
- Normal discussion of firearms, ammunition, drills, range rules, gear, course logistics handled inside TacLink
- The course's own range/business name, city, address, or map pin needed for the booked location
- Course descriptions of what students will learn, prices, schedules, prerequisites, equipment lists
- Photos of ranges, gear, targets, instructors at work — unless they contain visible contact info / handles / QR codes
- Polite chat, questions about the course
- Anything sexual, violent, or harassing — those are NOT in scope for this classifier

Severity:
- high = a real phone number, email, social handle, QR code, or external booking link clearly intended to bypass the platform
- medium = vague suggestion to communicate or book off-platform without specific contact info ("text me later", "find me on IG", "book on my site")
- low = ambiguous wording that could be benign

If nothing matches, return flagged=false, category="none", severity="none", reason="".`;

async function moderateWithAI(body: Body): Promise<{
  flagged: boolean;
  category: string;
  severity: string;
  reason: string;
  raw: unknown;
}> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const userContent: Array<Record<string, unknown>> = [];
  if (body.text && body.text.trim()) {
    userContent.push({
      type: "text",
      text: `Content type: ${body.contentType}\n\nText to moderate:\n"""${body.text}"""`,
    });
  }
  if (body.imageUrl) {
    userContent.push({
      type: "text",
      text: `Content type: ${body.contentType}. Moderate this image:`,
    });
    userContent.push({
      type: "image_url",
      image_url: { url: body.imageUrl },
    });
  }
  if (userContent.length === 0) {
    return { flagged: false, category: "none", severity: "none", reason: "empty input", raw: null };
  }

  const resp = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "report_moderation" } },
      }),
    },
  );

  if (!resp.ok) {
    const t = await resp.text();
    console.error("AI gateway error", resp.status, t);
    throw new Error(`AI gateway ${resp.status}`);
  }

  const data = await resp.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  const args = call?.function?.arguments
    ? JSON.parse(call.function.arguments)
    : null;
  if (!args) {
    return { flagged: false, category: "none", severity: "none", reason: "no tool result", raw: data };
  }
  return {
    flagged: !!args.flagged,
    category: String(args.category ?? "none"),
    severity: String(args.severity ?? "none"),
    reason: String(args.reason ?? ""),
    raw: data,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require an authenticated user — moderation is always called from
    // signed-in client contexts (messaging, course creation, reviews).
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.contentType) {
      return new Response(JSON.stringify({ error: "contentType required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await moderateWithAI(body);

    // Service-role client bypasses RLS for cross-table writes
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (result.flagged) {
      const excerpt = body.text
        ? body.text.slice(0, 280)
        : body.imageUrl
          ? body.imageUrl
          : null;

      await admin.from("flagged_content").insert({
        content_type: body.contentType,
        content_id: body.contentId ?? null,
        conversation_id: body.conversationId ?? null,
        course_id: body.courseId ?? null,
        author_id: body.authorId ?? null,
        author_role: body.authorRole ?? null,
        category: result.category,
        severity: result.severity,
        reason: result.reason,
        excerpt,
        image_url: body.imageUrl ?? null,
        ai_raw: result.raw as never,
        status: "pending",
      });

      // Hide source row from regular users until reviewed
      if (body.contentType === "message" && body.contentId) {
        await admin
          .from("messages")
          .update({
            moderation_status: "flagged",
            moderation_reason: result.reason,
            moderation_severity: result.severity,
            is_flagged: true,
            flag_reason: result.reason,
          })
          .eq("id", body.contentId);
      } else if (
        (body.contentType === "course_text" ||
          body.contentType === "course_image") &&
        body.contentId
      ) {
        await admin
          .from("courses")
          .update({
            moderation_status: "flagged",
            moderation_reason: result.reason,
            moderation_severity: result.severity,
          })
          .eq("id", body.contentId);
      }
    }

    return new Response(
      JSON.stringify({
        flagged: result.flagged,
        category: result.category,
        severity: result.severity,
        reason: result.reason,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("moderate-content error", e);
    // Fail-open: do not block legitimate content if moderation itself fails.
    return new Response(
      JSON.stringify({
        flagged: false,
        category: "none",
        severity: "none",
        reason: "moderation_unavailable",
        error: e instanceof Error ? e.message : "unknown",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
