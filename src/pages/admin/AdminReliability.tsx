import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Loader2, RefreshCw, ExternalLink, CheckCircle2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Event = {
  id: string;
  path: string;
  referrer: string | null;
  user_agent: string | null;
  user_id: string | null;
  user_role: string | null;
  release_id: string | null;
  created_at: string;
};

type Resolution = {
  id: string;
  path: string;
  resolved_at: string;
  notes: string | null;
  release_id: string | null;
};

type Tab = "open" | "resolved";

export default function AdminReliability() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [tab, setTab] = useState<Tab>("open");
  const [fixingPath, setFixingPath] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [releaseId, setReleaseId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: evs }, { data: res }] = await Promise.all([
      supabase
        .from("route_404_events")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("route_404_resolutions")
        .select("*")
        .order("resolved_at", { ascending: false }),
    ]);
    setEvents((evs ?? []) as Event[]);
    setResolutions((res ?? []) as Resolution[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resolvedSet = useMemo(() => {
    const m = new Map<string, Resolution>();
    for (const r of resolutions) m.set(r.path, r);
    return m;
  }, [resolutions]);

  const byPath = useMemo(() => {
    const m = new Map<string, Event[]>();
    for (const e of events) {
      if (!m.has(e.path)) m.set(e.path, []);
      m.get(e.path)!.push(e);
    }
    const rows = Array.from(m.entries())
      .map(([path, evs]) => {
        const fix = resolvedSet.get(path);
        const evsAfterFix = fix
          ? evs.filter((e) => new Date(e.created_at) > new Date(fix.resolved_at))
          : evs;
        return {
          path,
          totalCount: evs.length,
          countSinceFix: evsAfterFix.length,
          last: evs[0],
          resolution: fix ?? null,
        };
      })
      .sort((a, b) => b.totalCount - a.totalCount);
    return rows;
  }, [events, resolvedSet]);

  const open = byPath.filter((r) => !r.resolution || r.countSinceFix > 0);
  const resolved = byPath.filter((r) => r.resolution && r.countSinceFix === 0);

  const last24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return events.filter((e) => new Date(e.created_at).getTime() >= cutoff).length;
  }, [events]);

  const openFixDialog = (path: string) => {
    setFixingPath(path);
    setNotes("");
    setReleaseId("");
  };

  const submitFix = async () => {
    if (!fixingPath) return;
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("route_404_resolutions")
      .upsert(
        {
          path: fixingPath,
          notes: notes.trim() || null,
          release_id: releaseId.trim() || null,
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
        },
        { onConflict: "path" },
      );
    setSubmitting(false);
    if (error) {
      toast.error("Could not record fix", { description: error.message });
      return;
    }
    toast.success("Marked as fixed");
    setFixingPath(null);
    load();
  };

  const reopen = async (path: string) => {
    const { error } = await supabase.from("route_404_resolutions").delete().eq("path", path);
    if (error) { toast.error(error.message); return; }
    toast.success("Reopened");
    load();
  };

  const rows = tab === "open" ? open : resolved;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Reliability</h1>
          <p className="text-sm text-muted-foreground mt-1">
            404s captured from real user sessions over the last 30 days. Mark a path fixed once you ship a release that resolves it.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="404s last 24h" value={last24h} tone={last24h > 0 ? "destructive" : "ok"} />
        <Tile label="404s last 30d" value={events.length} tone={events.length > 0 ? "warn" : "ok"} />
        <Tile label="Open broken paths" value={open.length} tone={open.length > 0 ? "destructive" : "ok"} />
        <Tile label="Resolved paths" value={resolved.length} tone="ok" />
      </div>

      <div className="flex gap-2">
        {(["open", "resolved"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider " +
              (tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")
            }
          >
            {t === "open" ? `Open (${open.length})` : `Resolved (${resolved.length})`}
          </button>
        ))}
      </div>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <header className="px-4 py-3 border-b border-border flex items-center gap-2">
          {tab === "open" ? (
            <><AlertTriangle className="h-4 w-4 text-amber-500" /><h2 className="text-sm font-bold">Open broken paths</h2></>
          ) : (
            <><CheckCircle2 className="h-4 w-4 text-emerald-500" /><h2 className="text-sm font-bold">Resolved</h2></>
          )}
        </header>
        {loading ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin inline" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {tab === "open" ? "No open 404s — nice." : "Nothing marked resolved yet."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Path</th>
                <th className="text-left px-3 py-2">Hits {tab === "open" && "(since last fix)"}</th>
                <th className="text-left px-3 py-2">Last seen</th>
                <th className="text-left px-3 py-2">{tab === "open" ? "Last referrer" : "Resolution"}</th>
                <th className="text-right px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.path} className="border-t border-border hover:bg-muted/20 align-top">
                  <td className="px-3 py-2 font-mono text-xs break-all">
                    <a href={row.path} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">
                      {row.path} <ExternalLink className="h-3 w-3 opacity-50" />
                    </a>
                  </td>
                  <td className="px-3 py-2 font-bold">
                    {tab === "open" ? row.countSinceFix : row.totalCount}
                    {tab === "open" && row.resolution && row.countSinceFix > 0 && (
                      <div className="text-[10px] font-normal text-amber-500 mt-0.5">⚠️ regressed since fix</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {new Date(row.last.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs break-all">
                    {tab === "open"
                      ? (row.last.referrer ?? "—")
                      : (
                        <div>
                          <div>v{row.resolution!.release_id ?? "—"} · {new Date(row.resolution!.resolved_at).toLocaleDateString()}</div>
                          {row.resolution!.notes && <div className="italic text-foreground/80 mt-0.5">"{row.resolution!.notes}"</div>}
                        </div>
                      )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {tab === "open" ? (
                      <Button size="sm" variant="outline" onClick={() => openFixDialog(row.path)}>
                        <Wrench className="h-3.5 w-3.5 mr-1" /> Mark fixed
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => reopen(row.path)}>
                        Reopen
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground space-y-2">
        <h3 className="text-sm font-bold text-foreground">CI guard</h3>
        <p>
          Every PR runs <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">npm run audit:routes</code> via{" "}
          <code>.github/workflows/route-audit.yml</code>. The deploy fails when any{" "}
          <code>to=</code>, <code>backTo=</code>, <code>navigate(...)</code>, or <code>href=</code> in <code>src/</code> points
          at a path that's not declared in <code>App.tsx</code>.
        </p>
      </section>

      <Dialog open={!!fixingPath} onOpenChange={(v) => !v && setFixingPath(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark <span className="font-mono text-sm break-all">{fixingPath}</span> as fixed</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Release / version</label>
              <Input value={releaseId} onChange={(e) => setReleaseId(e.target.value)} placeholder="e.g. 2026.05.06-r3" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What was wrong, what fixed it, follow-up?"
                className="mt-1 min-h-24"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Any new 404 hits to this path after now will reopen it as a regression.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFixingPath(null)}>Cancel</Button>
            <Button onClick={submitFix} disabled={submitting}>
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />} Mark fixed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Tile = ({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" | "destructive" }) => (
  <div
    className={
      "rounded-lg border bg-card p-4 " +
      (tone === "destructive" ? "border-destructive/50" : tone === "warn" ? "border-amber-500/40" : "border-emerald-500/40")
    }
  >
    <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</div>
    <div className="text-2xl font-extrabold mt-1">{value}</div>
  </div>
);
