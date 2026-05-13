// Send Web Push notifications via VAPID. Called by the notifications-insert
// trigger (pg_net) with { recipient_id, title, body, link, type, notification_id }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const rawVapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@taclink.app";
const subjectEmail = rawVapidSubject.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
const VAPID_SUBJECT = subjectEmail
  ? `mailto:${subjectEmail}`
  : rawVapidSubject.trim().replace(/[",<>\s]+/g, "") || "mailto:support@taclink.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payloadBody = await req.json();
    let { recipient_id, title, body, link, type, notification_id, test } = payloadBody;

    if (test === true) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const { data, error } = token ? await admin.auth.getUser(token) : { data: null, error: new Error("Missing auth token") };
      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: "Sign in again to send a test notification" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      recipient_id = data.user.id;
      title = "Test notification";
      body = "If you see this, Web Push is working 🎉";
      link = "/notifications";
      type = "test";
    }

    if (!recipient_id || !title) {
      return new Response(JSON.stringify({ error: "recipient_id and title required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", recipient_id);
    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title,
      body: body ?? "",
      link: link ?? "/",
      type: type ?? "generic",
      notification_id: notification_id ?? null,
    });

    let sent = 0;
    const stale: string[] = [];
    await Promise.all(
      subs.map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 * 60 * 24 },
          );
          sent++;
        } catch (e: any) {
          const code = e?.statusCode;
          if (code === 404 || code === 410) stale.push(s.id);
          else console.error("push failed", code, e?.body || e?.message);
        }
      }),
    );

    if (stale.length) {
      await admin.from("push_subscriptions").delete().in("id", stale);
    }

    return new Response(JSON.stringify({ ok: true, sent, pruned: stale.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-web-push error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
