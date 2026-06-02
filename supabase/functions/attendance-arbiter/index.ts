// attendance-arbiter — AI-assisted decision on disputed attendance claims.
// Given a claim_id (typically called when a student denies), pull the claim,
// proximity events, message history snippets, and past behavior, then ask
// Lovable AI to return a structured verdict. Auto-resolve only when
// confidence is high; otherwise flip to admin_review.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AUTO_DECIDE_THRESHOLD = 0.85;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // AuthZ: only the platform's cron job or an admin user may invoke this.
    // Without this gate, anyone who guesses a claim UUID could force a verdict.
    const cronSecret = Deno.env.get("CRON_SECRET");
    const provided = req.headers.get("x-cron-secret");
    const cronOk = !!cronSecret && !!provided && provided === cronSecret;

    let adminOk = false;
    if (!cronOk) {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (authHeader.startsWith("Bearer ")) {
        try {
          const userClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } },
          );
          const { data: u } = await userClient.auth.getUser();
          const uid = u?.user?.id;
          if (uid) {
            const adminClient = createClient(
              Deno.env.get("SUPABASE_URL")!,
              Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            );
            const { data: roleRow } = await adminClient
              .from("user_roles")
              .select("role")
              .eq("user_id", uid)
              .eq("role", "admin")
              .maybeSingle();
            adminOk = !!roleRow;
          }
        } catch (_) { /* fall through */ }
      }
    }
    if (!cronOk && !adminOk) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { claim_id } = await req.json().catch(() => ({}));
    if (!claim_id || typeof claim_id !== "string") {
      return new Response(JSON.stringify({ error: "claim_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: claim, error: cErr } = await admin
      .from("attendance_claims")
      .select("*")
      .eq("id", claim_id)
      .maybeSingle();
    if (cErr || !claim) {
      return new Response(JSON.stringify({ error: "Claim not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull supporting context.
    const [{ data: prox }, { data: course }, { data: prevClaims }] = await Promise.all([
      admin
        .from("proximity_events")
        .select("distance_m, accuracy_m, smoothed_m, source, verified, created_at")
        .eq("booking_id", claim.booking_id)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("courses")
        .select("title, starts_at, ends_at, lat, lng, address")
        .eq("id", claim.course_id)
        .maybeSingle(),
      admin
        .from("attendance_claims")
        .select("status")
        .eq("instructor_id", claim.instructor_id)
        .neq("id", claim.id)
        .limit(100),
    ]);

    const verifiedHandshakes = (prox ?? []).filter((p: any) => p.verified).length;
    const closeHits = (prox ?? []).filter((p: any) => (p.smoothed_m ?? 9999) <= 25).length;
    const instructorTotal = prevClaims?.length ?? 0;
    const instructorDenied = (prevClaims ?? []).filter((c: any) => c.status === "denied").length;
    const denyRate = instructorTotal > 0 ? instructorDenied / instructorTotal : 0;

    const context = {
      course: {
        title: course?.title,
        starts_at: course?.starts_at,
        ends_at: course?.ends_at,
      },
      claim: {
        instructor_note: claim.instructor_note,
        student_response_note: claim.student_response_note,
        student_responded: !!claim.student_responded_at,
        evidence: claim.evidence,
      },
      proximity_summary: {
        total_events: prox?.length ?? 0,
        verified_handshakes: verifiedHandshakes,
        close_hits_under_25m: closeHits,
        latest: (prox ?? []).slice(0, 5),
      },
      instructor_history: {
        prior_claims: instructorTotal,
        prior_denied: instructorDenied,
        deny_rate: Math.round(denyRate * 100) / 100,
      },
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let aiResult: { decision: string; confidence: number; reasoning: string } = {
      decision: "needs_review",
      confidence: 0.5,
      reasoning: "AI unavailable; defaulted to admin review.",
    };

    if (LOVABLE_API_KEY) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                "You arbitrate disputed course-attendance claims. Weigh: verified proximity handshakes (strong evidence student was there), GPS hits within 25m of the course location near course time, the instructor's deny rate (high deny rate = less trustworthy claim), the specificity of the instructor's note, and the student's dispute reasoning. Return strict JSON only.",
            },
            {
              role: "user",
              content:
                "Decide the attendance claim and respond with JSON only matching this shape: " +
                '{"decision":"approve_attendance"|"deny_attendance"|"needs_review","confidence":0..1,"reasoning":"..."}.\n\nContext:\n' +
                JSON.stringify(context),
            },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (resp.ok) {
        const j = await resp.json();
        const txt = j?.choices?.[0]?.message?.content ?? "{}";
        try {
          const parsed = JSON.parse(txt);
          if (parsed && typeof parsed === "object") {
            aiResult = {
              decision: String(parsed.decision ?? "needs_review"),
              confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5))),
              reasoning: String(parsed.reasoning ?? "").slice(0, 1000),
            };
          }
        } catch {
          // keep default
        }
      } else if (resp.status === 429 || resp.status === 402) {
        aiResult.reasoning = `AI rate/credit limit (${resp.status}); routed to admin.`;
      }
    }

    // Decide final status.
    let finalStatus: string;
    if (
      aiResult.decision === "approve_attendance" &&
      aiResult.confidence >= AUTO_DECIDE_THRESHOLD
    ) {
      finalStatus = "auto_approved";
    } else if (
      aiResult.decision === "deny_attendance" &&
      aiResult.confidence >= AUTO_DECIDE_THRESHOLD
    ) {
      finalStatus = "denied";
    } else {
      finalStatus = "admin_review";
    }

    await admin
      .from("attendance_claims")
      .update({
        status: finalStatus,
        ai_decision: aiResult.decision,
        ai_confidence: aiResult.confidence,
        ai_reasoning: aiResult.reasoning,
      })
      .eq("id", claim.id);

    return new Response(
      JSON.stringify({ ok: true, status: finalStatus, ai: aiResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
