import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, PlayCircle, ShieldCheck, AlertTriangle, CheckCircle2, Wrench, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Run = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  triggered_by: string;
  total_checks: number;
  passed: number;
  failed: number;
  auto_fixed: number;
  duration_ms: number | null;
};

type Finding = {
  id: string;
  run_id: string;
  category: string;
  check_name: string;
  status: "pass" | "fail" | "warn";
  detail: string | null;
  target: string | null;
  auto_fixed: boolean;
  fix_notes: string | null;
};

export function SmokeTestPanel() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("smoke_test_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);
    const list = (data ?? []) as Run[];
    setRuns(list);
    if (list.length && !selectedRun) setSelectedRun(list[0].id);
    setLoading(false);
  };

  const loadFindings = async (runId: string) => {
    const { data } = await supabase
      .from("smoke_test_findings")
      .select("*")
      .eq("run_id", runId)
      .order("category", { ascending: true });
    setFindings((data ?? []) as Finding[]);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (selectedRun) loadFindings(selectedRun); }, [selectedRun]);

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("smoke-test-runner", {
        body: { trigger: "manual" },
      });
      if (error) throw error;
      toast.success(`Smoke test ${data?.status} — ${data?.passed}/${data?.total} checks passed`, {
        description: data?.auto_fixed > 0 ? `Auto-fixed ${data.auto_fixed} issue(s).` : undefined,
      });
      await load();
      if (data?.run_id) setSelectedRun(data.run_id);
    } catch (e: any) {
      toast.error("Smoke test failed", { description: e?.message });
    } finally {
      setRunning(false);
    }
  };

  const last = runs[0];
  const successRate = last && last.total_checks > 0
    ? Math.round((last.passed / last.total_checks) * 100)
    : null;

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <header className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        <h2 className="text-sm font-bold">System Smoke Test</h2>
        <span className="text-[11px] text-muted-foreground">
          End-to-end audit running every 5 minutes — probes routes, edge functions, DB invariants, and auto-remediates known issues.
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5" /> <span className="ml-1.5">Refresh</span>
          </Button>
          <Button size="sm" onClick={runNow} disabled={running}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Run smoke test now</span>
          </Button>
        </div>
      </header>

      <div className="grid md:grid-cols-4 gap-3 p-4 border-b border-border">
        <Stat label="Last run" value={last ? new Date(last.started_at).toLocaleTimeString() : "—"} />
        <Stat label="Status" value={last?.status ?? "—"} tone={last?.status === "passed" ? "ok" : last?.status === "failed" ? "bad" : "muted"} />
        <Stat label="Pass rate" value={successRate != null ? `${successRate}%` : "—"} tone={successRate != null ? (successRate === 100 ? "ok" : successRate >= 80 ? "warn" : "bad") : "muted"} />
        <Stat label="Auto-fixed (last run)" value={last?.auto_fixed ?? 0} tone={(last?.auto_fixed ?? 0) > 0 ? "ok" : "muted"} />
      </div>

      <div className="grid md:grid-cols-[260px_1fr]">
        <div className="border-r border-border max-h-96 overflow-auto">
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-3 py-2 bg-muted/40">
            Recent runs
          </div>
          {loading && runs.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin inline" /> Loading…</div>
          ) : runs.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">No runs yet. Click "Run smoke test now".</div>
          ) : (
            <ul className="divide-y divide-border">
              {runs.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedRun(r.id)}
                    className={
                      "w-full text-left px-3 py-2 hover:bg-muted/30 " +
                      (selectedRun === r.id ? "bg-muted/40" : "")
                    }
                  >
                    <div className="flex items-center gap-2">
                      {r.status === "passed" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : r.status === "failed" ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}
                      <span className="text-xs font-bold">{r.passed}/{r.total_checks}</span>
                      {r.auto_fixed > 0 && (
                        <span className="text-[10px] inline-flex items-center gap-1 text-emerald-500">
                          <Wrench className="h-3 w-3" />{r.auto_fixed}
                        </span>
                      )}
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-auto">
                        {r.triggered_by}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(r.started_at).toLocaleString()}
                      {r.duration_ms && ` · ${r.duration_ms}ms`}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="max-h-96 overflow-auto">
          {!selectedRun ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Select a run to view findings.</div>
          ) : findings.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">No findings recorded.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Category</th>
                  <th className="text-left px-3 py-2">Check</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((f) => (
                  <tr key={f.id} className="border-t border-border">
                    <td className="px-3 py-1.5 text-muted-foreground">{f.category}</td>
                    <td className="px-3 py-1.5 font-mono text-[11px] break-all">{f.check_name}</td>
                    <td className="px-3 py-1.5">
                      <span className={
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase " +
                        (f.status === "pass" ? "bg-emerald-500/10 text-emerald-500" :
                         f.status === "warn" ? "bg-amber-500/10 text-amber-500" :
                         "bg-destructive/10 text-destructive")
                      }>
                        {f.status}
                        {f.auto_fixed && <Wrench className="h-2.5 w-2.5" />}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground break-all">
                      {f.detail}
                      {f.fix_notes && <div className="text-emerald-500 italic mt-0.5">↳ {f.fix_notes}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, tone = "muted" }: { label: string; value: any; tone?: "ok" | "warn" | "bad" | "muted" }) {
  const cls =
    tone === "ok" ? "text-emerald-500" :
    tone === "warn" ? "text-amber-500" :
    tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</div>
      <div className={`text-lg font-extrabold mt-1 ${cls}`}>{String(value)}</div>
    </div>
  );
}
