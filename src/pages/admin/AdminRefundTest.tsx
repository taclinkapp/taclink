import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, Play, CheckCircle2, XCircle, AlertTriangle, RotateCw, FlaskConical,
} from "lucide-react";
import { AdminHeader } from "./AdminDashboard";

type Run = {
  id: string;
  created_at: string;
  completed_at: string | null;
  status: "running" | "passed" | "failed" | "partial" | "error";
  booking_id: string;
  helcim_transaction_id: string | null;
  helcim_refund_txn_id: string | null;
  amount_cents: number;
  webhook_received: boolean;
  webhook_signature_valid: boolean | null;
  booking_updated: boolean;
  refund_row_updated: boolean;
  ledger_reversed: boolean;
  checks: Array<{ name: string; pass: boolean; detail?: string }>;
  error_message: string | null;
  before_snapshot: any;
  after_snapshot: any;
  helcim_refund_response: any;
};

type BookingOpt = {
  id: string;
  helcim_transaction_id: string;
  online_total_cents: number;
  booked_at: string;
};

const statusBadge = (s: Run["status"]) => {
  switch (s) {
    case "passed":
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />PASSED</Badge>;
    case "partial":
      return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30"><AlertTriangle className="h-3 w-3 mr-1" />PARTIAL</Badge>;
    case "failed":
      return <Badge className="bg-red-500/15 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />FAILED</Badge>;
    case "error":
      return <Badge className="bg-red-500/15 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />ERROR</Badge>;
    default:
      return <Badge className="bg-primary/15 text-primary border-primary/30"><Loader2 className="h-3 w-3 mr-1 animate-spin" />RUNNING</Badge>;
  }
};

const Check = ({ pass, name, detail }: { pass: boolean; name: string; detail?: string }) => (
  <div className="flex items-start gap-2 text-sm">
    {pass
      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
      : <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />}
    <div className="flex-1">
      <span className={pass ? "text-foreground" : "text-muted-foreground"}>{name}</span>
      {detail && <span className="ml-2 text-xs text-muted-foreground">— {detail}</span>}
    </div>
  </div>
);

export default function AdminRefundTest() {
  const [bookings, setBookings] = useState<BookingOpt[]>([]);
  const [bookingId, setBookingId] = useState<string>("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const loadBookings = async () => {
    const { data } = await supabase
      .from("bookings")
      .select("id, helcim_transaction_id, online_total_cents, booked_at")
      .not("helcim_transaction_id", "is", null)
      .order("booked_at", { ascending: false })
      .limit(25);
    setBookings((data ?? []) as BookingOpt[]);
  };

  const loadRuns = async () => {
    const { data } = await supabase
      .from("refund_test_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setRuns((data ?? []) as unknown as Run[]);
  };

  const refresh = async () => {
    setLoading(true);
    await Promise.all([loadBookings(), loadRuns()]);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const id = setInterval(loadRuns, 5_000);
    return () => clearInterval(id);
  }, []);

  const start = async () => {
    if (!bookingId) {
      toast.error("Pick a booking with a Helcim transaction");
      return;
    }
    setStarting(true);
    const { data, error } = await supabase.functions.invoke("refund-test-run", {
      body: { booking_id: bookingId, amount_cents: 500 },
    });
    setStarting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if ((data as any)?.error) {
      toast.error((data as any).error);
      return;
    }
    toast.success("Refund test started — polling for webhook…");
    await loadRuns();
  };

  return (
    <>
      <AdminHeader title="Live Refund Test" subtitle="Issue a real $1 Helcim refund and verify the full webhook → DB chain" />
      <div className="p-6 space-y-6 max-w-5xl">
        <div className="tactical-card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center text-primary shrink-0">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold">Run a $1 refund test</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pick a booking that was paid through Helcim. We'll issue a $1 refund,
                wait for Helcim's webhook, and verify the booking, refund row, and
                instructor ledger were all updated correctly.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <Select value={bookingId} onValueChange={setBookingId}>
              <SelectTrigger className="h-10 bg-background border-border">
                <SelectValue placeholder={loading ? "Loading bookings…" : "Select a Helcim-paid booking"} />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                {bookings.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No bookings with a Helcim transaction yet. Book a course end-to-end first.
                  </div>
                )}
                {bookings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    <span className="font-mono text-xs">{b.id.slice(0, 8)}</span>
                    {" · "}
                    txn {b.helcim_transaction_id?.slice(0, 10)}…
                    {" · "}
                    ${(b.online_total_cents / 100).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={start}
              disabled={starting || !bookingId}
              className="h-10 bg-primary text-primary-foreground font-bold"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Run $1 refund test
            </Button>
          </div>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
            <strong>This is a real refund.</strong> $1.00 will be returned to the student's card and reversed
            in the instructor's ledger. Use a booking you control.
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="font-bold">Recent test runs</h3>
          <Button size="sm" variant="ghost" onClick={loadRuns}>
            <RotateCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
        </div>

        {runs.length === 0 && !loading && (
          <div className="tactical-card p-6 text-center text-sm text-muted-foreground">
            No refund tests yet.
          </div>
        )}

        <div className="space-y-3">
          {runs.map((r) => (
            <div key={r.id} className="tactical-card p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {statusBadge(r.status)}
                  <span className="text-xs text-muted-foreground font-mono">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  ${(r.amount_cents / 100).toFixed(2)} · booking{" "}
                  <span className="font-mono">{r.booking_id.slice(0, 8)}</span>
                </div>
              </div>

              {r.error_message && (
                <div className="text-xs text-red-400 font-mono bg-red-500/5 border border-red-500/20 rounded p-2">
                  {r.error_message}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {(r.checks ?? []).map((c, i) => (
                  <Check key={i} pass={c.pass} name={c.name} detail={c.detail} />
                ))}
                {(!r.checks || r.checks.length === 0) && r.status === "running" && (
                  <div className="text-xs text-muted-foreground col-span-2">
                    Polling Helcim webhook + DB updates… (up to 90s)
                  </div>
                )}
              </div>

              {r.helcim_refund_txn_id && (
                <div className="text-[11px] text-muted-foreground font-mono">
                  Helcim refund txn: {r.helcim_refund_txn_id}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
