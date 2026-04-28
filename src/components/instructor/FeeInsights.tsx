import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2, Wallet, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fmt } from "@/lib/fees";

type Insight = {
  totals: {
    bookings: number;
    gross: number;
    platform: number;
    deposits_online: number;
    due_in_person: number;
  };
  instructor_total: number;
  summary: string;
  outlook: string;
};

export const FeeInsights = () => {
  const { profile } = useAuth();
  const isSubscribed = profile?.subscription_status === "active";
  const [data, setData] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke<Insight>("fee-insights");
      if (error) throw error;
      setData(data ?? null);
    } catch (e: any) {
      setErr(e?.message ?? "Could not load insights");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="tactical-card border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold">AI Payout Insights · 30d</h3>
      </div>

      {loading && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Crunching your numbers…
        </div>
      )}

      {err && !loading && (
        <div className="text-xs text-destructive">
          {err} <Button variant="link" className="text-xs p-0 h-auto ml-1" onClick={load}>Retry</Button>
        </div>
      )}

      {data && !loading && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat label="Bookings" value={String(data.totals.bookings)} />
            <Stat label="Online" value={fmt(data.totals.deposits_online)} primary />
            <Stat label="Due in person" value={fmt(data.totals.due_in_person)} />
          </div>
          <div className="rounded-md bg-background/40 border border-border p-3 mb-2 flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5 text-primary shrink-0" />
            <div className="text-xs">
              <span className="text-muted-foreground">Your earnings: </span>
              <span className="font-bold text-primary">{fmt(data.instructor_total)}</span>
              <span className="text-muted-foreground"> · App fees: {fmt(data.totals.platform)}</span>
            </div>
          </div>
          <p className="text-xs text-foreground leading-relaxed">{data.summary}</p>
          {data.outlook && (
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-2 italic">{data.outlook}</p>
          )}
        </>
      )}
    </div>
  );
};

const Stat = ({ label, value, primary }: { label: string; value: string; primary?: boolean }) => (
  <div className="rounded-md border border-border bg-background/40 p-2">
    <div className={`text-sm font-black ${primary ? "text-primary" : "text-foreground"}`}>{value}</div>
    <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
  </div>
);
