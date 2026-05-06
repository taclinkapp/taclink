import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Activity, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Plus, Trash2, Loader2, Globe, ShieldCheck,
} from "lucide-react";
import { AdminHeader } from "./AdminDashboard";

type Monitor = {
  id: string;
  name: string;
  url: string;
  interval_minutes: number;
  expected_status: number;
  active: boolean;
  alert_emails: string[] | null;
  alert_threshold: number;
  consecutive_failures: number;
  last_status: string | null;
  last_checked_at: string | null;
  last_error: string | null;
};

type Check = {
  id: string;
  monitor_id: string;
  checked_at: string;
  status: string;
  http_status: number | null;
  response_ms: number | null;
  error: string | null;
};

type Domain = {
  id: string;
  domain: string;
  last_checked_at: string | null;
  https_ok: boolean | null;
  http_status: number | null;
  ssl_valid: boolean | null;
  ssl_expires_at: string | null;
  ssl_days_remaining: number | null;
  error: string | null;
};

const StatusBadge = ({ s }: { s: string | null }) => {
  if (s === "up")
    return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />UP</Badge>;
  if (s === "degraded")
    return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30"><AlertTriangle className="h-3 w-3 mr-1" />DEGRADED</Badge>;
  if (s === "down")
    return <Badge className="bg-red-500/15 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />DOWN</Badge>;
  return <Badge variant="outline">—</Badge>;
};

export default function AdminUptime() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [checks, setChecks] = useState<Record<string, Check[]>>({});
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // New monitor form
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newInterval, setNewInterval] = useState(5);
  const [newEmails, setNewEmails] = useState("");

  const load = async () => {
    const [{ data: m }, { data: d }] = await Promise.all([
      supabase.from("uptime_monitors").select("*").order("created_at", { ascending: true }),
      supabase.from("domain_status").select("*").order("domain"),
    ]);
    setMonitors((m ?? []) as unknown as Monitor[]);
    setDomains((d ?? []) as unknown as Domain[]);
    if (m && m.length) {
      const ids = m.map((x: any) => x.id);
      const { data: c } = await supabase.from("uptime_checks")
        .select("*").in("monitor_id", ids)
        .order("checked_at", { ascending: false }).limit(300);
      const grouped: Record<string, Check[]> = {};
      (c ?? []).forEach((row: any) => {
        (grouped[row.monitor_id] ??= []).push(row);
      });
      setChecks(grouped);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  const checkNow = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.functions.invoke("uptime-runner", { body: { monitor_id: id } });
    setBusyId(null);
    if (error) toast.error(error.message);
    else toast.success("Check complete");
    load();
  };

  const toggleActive = async (m: Monitor) => {
    await supabase.from("uptime_monitors").update({ active: !m.active }).eq("id", m.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this monitor and its history?")) return;
    await supabase.from("uptime_monitors").delete().eq("id", id);
    load();
  };

  const addMonitor = async () => {
    if (!newName || !newUrl) {
      toast.error("Name and URL required");
      return;
    }
    const emails = newEmails.split(",").map((e) => e.trim()).filter(Boolean);
    const { error } = await supabase.from("uptime_monitors").insert({
      name: newName, url: newUrl, interval_minutes: newInterval, alert_emails: emails,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Monitor added");
    setNewName(""); setNewUrl(""); setNewEmails(""); setNewInterval(5);
    load();
  };

  const refreshDomains = async () => {
    // Trigger a sweep — domains refresh as part of it
    toast.message("Re-checking domains…");
    await supabase.functions.invoke("uptime-runner", { body: { monitor_id: monitors[0]?.id } });
    setTimeout(load, 1500);
  };

  return (
    <>
      <AdminHeader title="Uptime & Domains" subtitle="Built-in monitoring · runs every minute via scheduled job" />
      <div className="p-6 space-y-6 max-w-6xl">

        {/* Domains/SSL panel */}
        <div className="tactical-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="font-bold">Domains &amp; SSL</h2>
            </div>
            <Button size="sm" variant="ghost" onClick={refreshDomains}>
              <RefreshCw className="h-3 w-3 mr-1" /> Re-check
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {domains.map((d) => {
              const sslColor =
                d.ssl_days_remaining === null ? "text-muted-foreground" :
                d.ssl_days_remaining < 14 ? "text-red-400" :
                d.ssl_days_remaining < 30 ? "text-amber-400" : "text-emerald-400";
              return (
                <div key={d.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">{d.domain}</span>
                    </div>
                    {d.https_ok === true
                      ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">HTTPS OK</Badge>
                      : d.https_ok === false
                        ? <Badge className="bg-red-500/15 text-red-400 border-red-500/30">FAIL</Badge>
                        : <Badge variant="outline">unchecked</Badge>}
                  </div>
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">HTTP status</span>
                      <span className="font-mono">{d.http_status ?? "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SSL expires in</span>
                      <span className={`font-mono ${sslColor}`}>
                        {d.ssl_days_remaining === null ? "unknown" : `${d.ssl_days_remaining} days`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last verified</span>
                      <span className="font-mono">{d.last_checked_at ? new Date(d.last_checked_at).toLocaleString() : "never"}</span>
                    </div>
                    {d.error && (
                      <div className="text-red-400 mt-2 text-[11px] font-mono break-words">{d.error}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add monitor */}
        <div className="tactical-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <h2 className="font-bold">Add monitor</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="API health" className="bg-background h-10" />
            </div>
            <div>
              <Label className="text-xs">URL</Label>
              <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://taclink.app/health" className="bg-background h-10 font-mono" />
            </div>
            <div>
              <Label className="text-xs">Interval (minutes)</Label>
              <Input type="number" min={1} max={1440} value={newInterval}
                onChange={(e) => setNewInterval(Number(e.target.value) || 5)}
                className="bg-background h-10" />
            </div>
            <div>
              <Label className="text-xs">Alert emails (comma-separated)</Label>
              <Input value={newEmails} onChange={(e) => setNewEmails(e.target.value)} placeholder="ops@taclink.app" className="bg-background h-10" />
            </div>
          </div>
          <Button onClick={addMonitor} className="bg-primary text-primary-foreground font-bold">
            <Plus className="h-4 w-4 mr-1" /> Add monitor
          </Button>
        </div>

        {/* Monitors list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2"><Activity className="h-4 w-4" /> Monitors</h2>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {monitors.length === 0 && !loading && (
            <div className="tactical-card p-6 text-center text-sm text-muted-foreground">
              No monitors yet.
            </div>
          )}

          {monitors.map((m) => {
            const recent = checks[m.id] ?? [];
            const upCount = recent.filter((c) => c.status === "up").length;
            const total = recent.length;
            const uptimePct = total > 0 ? Math.round((upCount / total) * 100) : null;
            const avgMs = recent.length
              ? Math.round(recent.filter((c) => c.response_ms).reduce((a, c) => a + (c.response_ms ?? 0), 0) /
                  Math.max(1, recent.filter((c) => c.response_ms).length))
              : null;
            return (
              <div key={m.id} className="tactical-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold truncate">{m.name}</h3>
                      <StatusBadge s={m.last_status} />
                      {!m.active && <Badge variant="outline" className="text-xs">PAUSED</Badge>}
                    </div>
                    <a href={m.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground font-mono break-all hover:text-primary">{m.url}</a>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      every {m.interval_minutes}m · last check{" "}
                      {m.last_checked_at ? new Date(m.last_checked_at).toLocaleTimeString() : "never"}
                      {m.consecutive_failures > 0 && (
                        <span className="text-red-400 ml-2">· {m.consecutive_failures} consecutive failures</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={m.active} onCheckedChange={() => toggleActive(m)} />
                    <Button size="sm" variant="outline" disabled={busyId === m.id} onClick={() => checkNow(m.id)}>
                      {busyId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-400" onClick={() => remove(m.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {m.last_error && (
                  <div className="text-xs text-red-400 font-mono bg-red-500/5 border border-red-500/20 rounded p-2">
                    {m.last_error}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded bg-background border border-border p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Uptime ({total})</div>
                    <div className="font-bold text-lg">{uptimePct ?? "—"}{uptimePct !== null && "%"}</div>
                  </div>
                  <div className="rounded bg-background border border-border p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Avg latency</div>
                    <div className="font-bold text-lg">{avgMs !== null ? `${avgMs}ms` : "—"}</div>
                  </div>
                  <div className="rounded bg-background border border-border p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Threshold</div>
                    <div className="font-bold text-lg">{m.alert_threshold}</div>
                  </div>
                </div>

                {/* Sparkline of last 30 checks */}
                <div className="flex items-end gap-0.5 h-8">
                  {recent.slice(0, 30).reverse().map((c) => {
                    const color = c.status === "up" ? "bg-emerald-500"
                      : c.status === "degraded" ? "bg-amber-500" : "bg-red-500";
                    const h = Math.min(100, Math.max(15, (c.response_ms ?? 100) / 20));
                    return (
                      <div key={c.id} title={`${c.status} · ${c.http_status ?? "—"} · ${c.response_ms ?? "—"}ms · ${new Date(c.checked_at).toLocaleString()}`}
                        className={`w-1.5 rounded-sm ${color}`} style={{ height: `${h}%` }} />
                    );
                  })}
                  {recent.length === 0 && (
                    <span className="text-xs text-muted-foreground">no checks yet</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
