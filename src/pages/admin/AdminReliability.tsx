import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export default function AdminReliability() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("route_404_events")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    setEvents((data ?? []) as Event[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const byPath = useMemo(() => {
    const m = new Map<string, Event[]>();
    for (const e of events) {
      if (!m.has(e.path)) m.set(e.path, []);
      m.get(e.path)!.push(e);
    }
    return Array.from(m.entries())
      .map(([path, evs]) => ({ path, count: evs.length, last: evs[0], evs }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  const last24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return events.filter((e) => new Date(e.created_at).getTime() >= cutoff).length;
  }, [events]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Reliability</h1>
          <p className="text-sm text-muted-foreground mt-1">
            404s and broken-route events captured from real user sessions over the last 7 days.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Tile label="404s last 24h" value={last24h} tone={last24h > 0 ? "destructive" : "ok"} />
        <Tile label="404s last 7d" value={events.length} tone={events.length > 0 ? "warn" : "ok"} />
        <Tile label="Unique broken paths" value={byPath.length} tone={byPath.length > 0 ? "warn" : "ok"} />
      </div>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <header className="px-4 py-3 border-b border-border flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-bold">Top broken paths</h2>
        </header>
        {loading ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin inline" /> Loading…
          </div>
        ) : byPath.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No 404s recorded — nice.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Path</th>
                <th className="text-left px-3 py-2">Hits</th>
                <th className="text-left px-3 py-2">Last seen</th>
                <th className="text-left px-3 py-2">Last referrer</th>
                <th className="text-left px-3 py-2">Last role</th>
              </tr>
            </thead>
            <tbody>
              {byPath.map((row) => (
                <tr key={row.path} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs break-all">
                    <a href={row.path} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">
                      {row.path} <ExternalLink className="h-3 w-3 opacity-50" />
                    </a>
                  </td>
                  <td className="px-3 py-2 font-bold">{row.count}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {new Date(row.last.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs break-all">
                    {row.last.referrer ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{row.last.user_role ?? 'anon'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground space-y-2">
        <h3 className="text-sm font-bold text-foreground">How to fix dead links before users see them</h3>
        <p>
          Run <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">node scripts/audit-routes.mjs</code> locally
          (or in CI). It scans every <code>to=</code>, <code>backTo=</code>, <code>navigate(...)</code>, and <code>href=</code>{" "}
          string in <code>src/</code> and fails the build when a path doesn't match any route declared in <code>App.tsx</code>.
          Combined with the live 404 beacon above, that closes the loop on broken navigation.
        </p>
      </section>
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
