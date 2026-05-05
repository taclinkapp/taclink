// Diagnostic: pings Helcim's connection-test endpoint with the
// configured HELCIM_API_TOKEN and reports whether the merchant account
// is reachable. The response body from Helcim contains account info
// when present — we surface it raw so admins can verify whether they're
// on a developer-test terminal or a production one.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing authorization" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "owner");
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const apiToken = Deno.env.get("HELCIM_API_TOKEN");
    if (!apiToken) return json({ configured: false, message: "HELCIM_API_TOKEN not set" });

    const res = await fetch("https://api.helcim.com/v2/connection-test", {
      headers: { "api-token": apiToken, accept: "application/json" },
    });
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep raw */ }

    // Helcim's connection-test returns 200 on a valid token. We can't
    // detect "is sandbox" deterministically from this endpoint, but a
    // non-200 means the token is broken. The real signal for "wrong
    // terminal" comes from the INVALID CARD response on test cards.
    return json({
      configured: true,
      ok: res.ok,
      status: res.status,
      body: parsed,
      hint: res.ok
        ? "Token is valid. If Helcim test cards still return INVALID CARD, this token is attached to a production terminal — create a Helcim developer test account and use its api-token instead."
        : "Token rejected by Helcim. Check the value in Lovable Cloud secrets.",
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
