// Returns the Mapbox public token to the browser.
// Token is publishable (pk.*) — secured via URL restrictions in the Mapbox dashboard.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const token =
    Deno.env.get("MAPBOX_PUBLIC_TOKEN") ??
    Deno.env.get("MAPBOX_TOKEN") ??
    "";

  if (!token) {
    // Log available env keys (names only, no values) to help diagnose
    const available = Object.keys(Deno.env.toObject()).filter((k) =>
      k.toUpperCase().includes("MAPBOX"),
    );
    console.error("Mapbox token missing. MAPBOX_* keys present:", available);
    return new Response(
      JSON.stringify({
        error: "MAPBOX_PUBLIC_TOKEN not configured",
        hint: "Secret may not have propagated yet. Redeploy or wait ~30s.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ token }), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
});
