import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, RefreshCw, Sparkles, ArrowRight, Mail, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Brief = {
  id: string;
  week_starting: string;
  generated_at: string;
  metrics: Record<string, any>;
  summary: string | null;
  action_items: Array<{ title: string; why: string; how: string; priority: "high" | "medium" | "low" }>;
  emailed_at: string | null;
};

const priorityStyles: Record<string, string> = {
  high: "border-destructive/40 bg-destructive/5",
  medium: "border-amber-500/40 bg-amber-500/5",
  low: "border-emerald-500/40 bg-emerald-500/5",
};
const priorityBadge: Record<string, string> = {
  high: "bg-destructive text-destructive-foreground",
  medium: "bg-amber-500 text-white",
  low: "bg-emerald-500 text-white",
};

export default function WeeklyBrief() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cockpit_briefs")
      .select("*")
      .order("week_starting", { ascending: false })
      .limit(20);
    if (error) toast.error(error.message);
    const list = (data ?? []) as Brief[];
    setBriefs(list);
    if (list.length && !activeId) setActiveId(list[0].id);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const generateNow = async () => {
    setGenerating(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-weekly-brief`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
          body: JSON.stringify({}),
        },
      );
      if (!resp.ok) throw new Error(await resp.text());
      toast.success("Brief generated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setGenerating(false);
    }
  };

  const active = briefs.find((b) => b.id === activeId) ?? briefs[0];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Weekly Brief</h1>
            <p className="text-sm text-muted-foreground">
              Your AI chief-of-staff. Action items first, metrics second.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={generateNow} disabled={generating} variant="outline" size="sm">
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate now
          </Button>
          <Button onClick={load} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : briefs.length === 0 ? (
        <div className="tactical-card p-12 text-center space-y-3">
          <FileText className="h-12 w-12 mx-auto opacity-50" />
          <h2 className="text-lg font-semibold">No briefs yet</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your weekly brief is generated automatically every Monday at 7 AM and emailed to you.
            You can also generate one now to see what it looks like.
          </p>
          <Button onClick={generateNow} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate first brief
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* History sidebar */}
          <div className="col-span-12 md:col-span-3 space-y-2">
            <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground px-2">History</div>
            {briefs.map((b) => (
              <button
                key={b.id}
                onClick={() => setActiveId(b.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors",
                  active?.id === b.id && "ring-2 ring-primary border-primary",
                )}
              >
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Week of {b.week_starting}
                </div>
                <div className="text-sm font-semibold mt-1 line-clamp-2">
                  {b.summary?.slice(0, 80) ?? "(no summary)"}
                </div>
                {b.emailed_at && (
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600 mt-1">
                    <Mail className="h-2.5 w-2.5" /> Emailed
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Active brief */}
          <div className="col-span-12 md:col-span-9 space-y-6">
            {active && (
              <>
                <div className="tactical-card p-6">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Week of {active.week_starting}
                    {active.emailed_at && (
                      <Badge variant="outline" className="ml-2 text-[10px] border-emerald-500/40 text-emerald-600">
                        <Mail className="h-2.5 w-2.5 mr-1" /> Emailed
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-xl font-bold leading-tight">{active.summary}</h2>
                </div>

                {/* Action items */}
                <div className="space-y-3">
                  <h3 className="text-sm uppercase tracking-wider font-bold text-muted-foreground">
                    Do these {active.action_items.length} things this week
                  </h3>
                  {active.action_items.map((item, i) => (
                    <div
                      key={i}
                      className={cn(
                        "tactical-card p-5 border-l-4",
                        priorityStyles[item.priority],
                      )}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="text-base font-bold flex items-center gap-2">
                          <span className="text-muted-foreground">{i + 1}.</span> {item.title}
                        </h4>
                        <Badge className={cn("text-[10px] uppercase", priorityBadge[item.priority])}>
                          {item.priority}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-semibold text-muted-foreground">Why: </span>
                          <span>{item.why}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                          <span>{item.how}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Metrics */}
                <div className="tactical-card p-5">
                  <h3 className="text-sm uppercase tracking-wider font-bold text-muted-foreground mb-3">
                    This week's snapshot
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Metric label="Pending decisions" value={active.metrics.pending_decisions} />
                    <Metric label="Auto-handled" value={active.metrics.auto_handled_this_week} />
                    <Metric label="Bookings (week)" value={active.metrics.bookings_this_week} compareTo={active.metrics.bookings_prev_week} />
                    <Metric label="New signups" value={active.metrics.new_signups_this_week} compareTo={active.metrics.new_signups_prev_week} />
                    <Metric label="Stuck deposits" value={active.metrics.stuck_deposits} />
                    <Metric label="Open tickets" value={active.metrics.open_support_tickets} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, compareTo }: { label: string; value: number; compareTo?: number }) {
  const v = value ?? 0;
  const prev = compareTo;
  const delta = prev != null && prev > 0 ? Math.round(((v - prev) / prev) * 100) : null;
  const deltaColor = delta == null ? "" : delta > 0 ? "text-emerald-600" : delta < 0 ? "text-destructive" : "";
  return (
    <div className="border border-border rounded-lg p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{v}</div>
      {delta != null && (
        <div className={cn("text-xs font-semibold mt-1", deltaColor)}>
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)}% vs last week
        </div>
      )}
    </div>
  );
}
