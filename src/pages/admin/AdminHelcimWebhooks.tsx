import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw, RotateCcw, Search, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type WebhookEvent = {
  id: string;
  event_id: string;
  event_type: string;
  environment: "sandbox" | "live";
  processing_status: "received" | "processing" | "succeeded" | "failed" | "retrying";
  last_error: string | null;
  attempt_count: number;
  helcim_transaction_id: string | null;
  booking_id: string | null;
  last_attempted_at: string | null;
  created_at: string;
};

type BookingRow = {
  id: string;
  helcim_transaction_id: string | null;
  helcim_checkout_token: string | null;
  payment_provider: string;
  deposit_status: string;
  online_total_cents: number;
  booked_at: string;
  student_id: string;
};

const statusBadge = (s: WebhookEvent["processing_status"]) => {
  switch (s) {
    case "succeeded":
      return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 gap-1"><CheckCircle2 className="h-3 w-3" />succeeded</Badge>;
    case "failed":
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />failed</Badge>;
    case "retrying":
      return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 gap-1"><RotateCcw className="h-3 w-3" />retrying</Badge>;
    case "processing":
      return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 gap-1"><Loader2 className="h-3 w-3 animate-spin" />processing</Badge>;
    default:
      return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />received</Badge>;
  }
};

export default function AdminHelcimWebhooks() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [b, e] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, helcim_transaction_id, helcim_checkout_token, payment_provider, deposit_status, online_total_cents, booked_at, student_id")
        .eq("payment_provider", "helcim")
        .order("booked_at", { ascending: false })
        .limit(200),
      supabase
        .from("helcim_webhook_events")
        .select("id, event_id, event_type, environment, processing_status, last_error, attempt_count, helcim_transaction_id, booking_id, last_attempted_at, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (b.error) toast.error(`Bookings: ${b.error.message}`);
    if (e.error) toast.error(`Events: ${e.error.message}`);
    setBookings((b.data ?? []) as BookingRow[]);
    setEvents((e.data ?? []) as WebhookEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = bookings.filter((row) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      row.helcim_transaction_id?.toLowerCase().includes(q) ||
      row.helcim_checkout_token?.toLowerCase().includes(q) ||
      row.id.toLowerCase().includes(q)
    );
  });

  const eventsByTxn = new Map<string, WebhookEvent[]>();
  const eventsByBooking = new Map<string, WebhookEvent[]>();
  for (const ev of events) {
    if (ev.helcim_transaction_id) {
      const arr = eventsByTxn.get(ev.helcim_transaction_id) ?? [];
      arr.push(ev); eventsByTxn.set(ev.helcim_transaction_id, arr);
    }
    if (ev.booking_id) {
      const arr = eventsByBooking.get(ev.booking_id) ?? [];
      arr.push(ev); eventsByBooking.set(ev.booking_id, arr);
    }
  }

  const handleRetry = async (ev: WebhookEvent) => {
    setRetrying(ev.id);
    try {
      // Mark as retrying first so admins see immediate feedback even if
      // the function takes a few seconds. The webhook handler will
      // overwrite this to succeeded/failed when it finishes.
      const { error: upErr } = await supabase
        .from("helcim_webhook_events")
        .update({
          processing_status: "retrying",
          attempt_count: ev.attempt_count + 1,
          last_attempted_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", ev.id);
      if (upErr) throw upErr;

      const { error: invokeErr } = await supabase.functions.invoke("pp-webhook", {
        body: { __retry: true, event_id: ev.event_id, environment: ev.environment },
      });
      if (invokeErr) throw invokeErr;
      toast.success("Retry queued");
      await load();
    } catch (e: any) {
      toast.error(`Retry failed: ${e?.message ?? e}`);
      await load();
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Helcim Webhooks</h1>
          <p className="text-sm text-muted-foreground">
            Bookings routed through Helcim and the webhook events that updated them.
          </p>
        </div>
        <Button onClick={load} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by helcim_transaction_id, checkout token, or booking id"
          className="pl-9"
        />
      </div>

      <div className="tactical-card overflow-hidden">
        <div className="px-4 py-3 border-b font-bold text-sm">
          Helcim bookings ({filtered.length})
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking</TableHead>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Latest webhook</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin inline mr-2" />Loading…
              </TableCell></TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                No Helcim bookings yet.
              </TableCell></TableRow>
            )}
            {!loading && filtered.map((b) => {
              const evs = [
                ...(b.helcim_transaction_id ? eventsByTxn.get(b.helcim_transaction_id) ?? [] : []),
                ...(eventsByBooking.get(b.id) ?? []),
              ];
              const latest = evs.sort((a, c) => c.created_at.localeCompare(a.created_at))[0] ?? null;
              return (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">{b.id.slice(0, 8)}…</TableCell>
                  <TableCell className="font-mono text-xs">
                    {b.helcim_transaction_id ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase">{b.deposit_status}</Badge>
                  </TableCell>
                  <TableCell>${(b.online_total_cents / 100).toFixed(2)}</TableCell>
                  <TableCell>
                    {latest ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          {statusBadge(latest.processing_status)}
                          <span className="text-[11px] text-muted-foreground">{latest.event_type}</span>
                        </div>
                        {latest.last_error && (
                          <span className="text-[11px] text-destructive truncate max-w-[260px]" title={latest.last_error}>
                            {latest.last_error}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">No webhook yet</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {latest && (latest.processing_status === "failed" || latest.processing_status === "retrying") && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retrying === latest.id}
                        onClick={() => handleRetry(latest)}
                      >
                        {retrying === latest.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Retry
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="tactical-card overflow-hidden">
        <div className="px-4 py-3 border-b font-bold text-sm">
          All recent webhook events ({events.length})
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Env</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Tx / Booking</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 && !loading && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                No webhook events recorded yet.
              </TableCell></TableRow>
            )}
            {events.map((ev) => (
              <TableRow key={ev.id}>
                <TableCell className="text-xs whitespace-nowrap">
                  {new Date(ev.created_at).toLocaleString()}
                </TableCell>
                <TableCell className="text-xs">{ev.event_type}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{ev.environment}</Badge></TableCell>
                <TableCell>{statusBadge(ev.processing_status)}</TableCell>
                <TableCell className="text-xs">{ev.attempt_count}</TableCell>
                <TableCell className="font-mono text-[11px]">
                  {ev.helcim_transaction_id ?? ev.booking_id ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  {(ev.processing_status === "failed" || ev.processing_status === "retrying") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={retrying === ev.id}
                      onClick={() => handleRetry(ev)}
                    >
                      {retrying === ev.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Retry
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
