import { useState } from "react";
import { Activity, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Result {
  configured: boolean;
  ok?: boolean;
  status?: number;
  body?: unknown;
  hint?: string;
  message?: string;
  error?: string;
}

/**
 * Admin-only diagnostic. Calls helcim-account-check which pings
 * Helcim's connection-test endpoint with the configured api-token.
 *
 * Use this when sandbox test cards keep returning INVALID CARD —
 * connection-test will confirm the token is valid; if it is and
 * test cards still fail, the terminal is production, not developer.
 */
export function HelcimAccountCheckCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    const { data, error } = await supabase.functions.invoke("helcim-account-check", { body: {} });
    setLoading(false);
    if (error) {
      setResult({ configured: false, error: error.message });
      return;
    }
    setResult(data as Result);
  };

  const ok = result?.ok === true;
  const Icon = !result ? Activity : ok ? CheckCircle2 : AlertTriangle;
  const tone = !result
    ? "border-primary/40 bg-primary/5"
    : ok
    ? "border-emerald-500/40 bg-emerald-500/5"
    : "border-destructive/40 bg-destructive/5";

  return (
    <div className={`tactical-card p-4 space-y-3 ${tone}`}>
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold">Helcim account diagnostic</div>
          <p className="text-xs text-muted-foreground">
            Pings Helcim's <span className="font-mono">/connection-test</span> with the configured token.
            If it succeeds but sandbox test cards still return <span className="font-mono">INVALID CARD</span>,
            the token is a production terminal — generate one from a Helcim developer test account instead.
          </p>
        </div>
      </div>
      <Button size="sm" onClick={run} disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Activity className="h-3.5 w-3.5 mr-2" />}
        Run check
      </Button>
      {result && (
        <pre className="text-[11px] bg-background/60 rounded p-2 overflow-auto max-h-48 font-mono">
{JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
