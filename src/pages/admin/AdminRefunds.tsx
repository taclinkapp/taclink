import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DollarSign, Loader2, RefreshCw, Search, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '@/lib/fees';
import { stripeEnvironment } from '@/lib/stripe';

type RefundType = 'platform_fee' | 'deposit' | 'full' | 'partial' | 'goodwill' | 'other';
type ReasonCategory =
  | 'instructor_no_show'
  | 'instructor_cancel'
  | 'fraud_safety'
  | 'student_cancel_timely'
  | 'student_cancel_late'
  | 'weather_reschedule'
  | 'quality_complaint'
  | 'chargeback_threat'
  | 'other';

const REASON_LABELS: Record<ReasonCategory, string> = {
  instructor_no_show: 'Instructor no-show',
  instructor_cancel: 'Instructor cancelled',
  fraud_safety: 'Fraud / safety incident',
  student_cancel_timely: 'Student cancel (≥ 48h)',
  student_cancel_late: 'Student cancel (< 48h)',
  weather_reschedule: 'Weather / reschedule',
  quality_complaint: 'Quality complaint',
  chargeback_threat: 'Chargeback / legal threat',
  other: 'Other (manual)',
};

type SplitPreview = {
  student_cash_refund_cents: number;
  instructor_forfeit_cents: number;
  platform_absorbed_cents: number;
  requires_owner: boolean;
  hours_before_course: number | null;
  rationale: string;
};
type RefundStatus = 'issued' | 'failed' | 'reversed';

type RefundRow = {
  id: string;
  booking_id: string;
  student_id: string;
  amount_cents: number;
  refund_type: RefundType;
  reason: string;
  status: RefundStatus;
  external_reference: string | null;
  notes: string | null;
  created_at: string;
  auto_issued?: boolean;
  risk_score?: number | null;
  risk_factors?: any;
  dispute_window_until?: string | null;
  instructor_disputed_at?: string | null;
  instructor_dispute_reason?: string | null;
  stripe_refund_id?: string | null;
  stripe_refund_status?: string | null;
  studentName?: string;
  courseTitle?: string;
};

type BookingLite = {
  id: string;
  course_id: string;
  student_id: string;
  online_total_cents: number;
  platform_fee_cents: number;
  deposit_amount_cents: number;
  studentName: string;
  courseTitle: string;
};

export const AdminRefunds = () => {
  const { user } = useAuth();
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [bookingQuery, setBookingQuery] = useState('');
  const [bookingResults, setBookingResults] = useState<BookingLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<BookingLite | null>(null);
  const [type, setType] = useState<RefundType>('platform_fee');
  const [reasonCategory, setReasonCategory] = useState<ReasonCategory>('student_cancel_timely');
  const [split, setSplit] = useState<SplitPreview | null>(null);
  const [splitLoading, setSplitLoading] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [externalRef, setExternalRef] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('refunds')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      toast.error('Could not load refunds', { description: error.message });
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as RefundRow[];
    const studentIds = Array.from(new Set(rows.map((r) => r.student_id)));
    const bookingIds = Array.from(new Set(rows.map((r) => r.booking_id)));

    const [{ data: profiles }, { data: bookings }] = await Promise.all([
      studentIds.length
        ? supabase.from('profiles').select('id, display_name').in('id', studentIds)
        : Promise.resolve({ data: [] as any[] }),
      bookingIds.length
        ? supabase.from('bookings').select('id, course_id').in('id', bookingIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const courseIds = Array.from(
      new Set((bookings ?? []).map((b: any) => b.course_id)),
    );
    const { data: courses } = courseIds.length
      ? await supabase.from('courses').select('id, title').in('id', courseIds)
      : { data: [] as any[] };

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]));
    const courseMap = new Map((courses ?? []).map((c: any) => [c.id, c.title]));
    const bookingMap = new Map((bookings ?? []).map((b: any) => [b.id, b.course_id]));

    setRefunds(
      rows.map((r) => ({
        ...r,
        studentName: profileMap.get(r.student_id) ?? 'Student',
        courseTitle: courseMap.get(bookingMap.get(r.booking_id) ?? '') ?? 'Course',
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    let issued = 0;
    let count = 0;
    refunds.forEach((r) => {
      if (r.status === 'issued') {
        issued += r.amount_cents;
        count += 1;
      }
    });
    return { issued, count };
  }, [refunds]);

  const searchBookings = async () => {
    if (!bookingQuery.trim()) return;
    setSearching(true);
    const q = bookingQuery.trim();

    // Try exact id first, then student name search.
    const { data: byId } =
      q.length === 36
        ? await supabase
            .from('bookings')
            .select('id, course_id, student_id, online_total_cents, platform_fee_cents, deposit_amount_cents')
            .eq('id', q)
            .limit(1)
        : { data: [] as any[] };

    let candidates = byId ?? [];
    if (candidates.length === 0) {
      // Search by student display_name or course title (admin scope; returns up to 25).
      const { data: profileMatches } = await supabase
        .from('profiles')
        .select('id')
        .ilike('display_name', `%${q}%`)
        .limit(25);
      const studentIds = (profileMatches ?? []).map((p: any) => p.id);
      const { data: courseMatches } = await supabase
        .from('courses')
        .select('id')
        .ilike('title', `%${q}%`)
        .limit(25);
      const courseIds = (courseMatches ?? []).map((c: any) => c.id);

      if (studentIds.length || courseIds.length) {
        let qb = supabase
          .from('bookings')
          .select('id, course_id, student_id, online_total_cents, platform_fee_cents, deposit_amount_cents')
          .order('created_at', { ascending: false })
          .limit(25);
        if (studentIds.length && courseIds.length) {
          qb = qb.or(
            `student_id.in.(${studentIds.join(',')}),course_id.in.(${courseIds.join(',')})`,
          );
        } else if (studentIds.length) {
          qb = qb.in('student_id', studentIds);
        } else {
          qb = qb.in('course_id', courseIds);
        }
        const { data } = await qb;
        candidates = data ?? [];
      }
    }

    const studentIds = Array.from(new Set(candidates.map((b: any) => b.student_id)));
    const courseIds = Array.from(new Set(candidates.map((b: any) => b.course_id)));
    const [{ data: profiles }, { data: courses }] = await Promise.all([
      studentIds.length
        ? supabase.from('profiles').select('id, display_name').in('id', studentIds)
        : Promise.resolve({ data: [] as any[] }),
      courseIds.length
        ? supabase.from('courses').select('id, title').in('id', courseIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]));
    const courseMap = new Map((courses ?? []).map((c: any) => [c.id, c.title]));

    setBookingResults(
      candidates.map((b: any) => ({
        ...b,
        studentName: profileMap.get(b.student_id) ?? 'Student',
        courseTitle: courseMap.get(b.course_id) ?? 'Course',
      })),
    );
    setSearching(false);
  };

  const suggestedAmount = (t: RefundType, b: BookingLite | null): number => {
    if (!b) return 0;
    switch (t) {
      case 'platform_fee':
        return b.platform_fee_cents;
      case 'deposit':
        return b.deposit_amount_cents;
      case 'full':
        // Online total already includes platform fee ($25) + instructor deposit (10%).
        // TacLink only ever credits what the student paid online — never the in-person 90%.
        return b.online_total_cents;
      default:
        return 0;
    }
  };

  const onPick = (b: BookingLite) => {
    setPicked(b);
    setAmount((suggestedAmount(type, b) / 100).toFixed(2));
  };

  const onTypeChange = (t: RefundType) => {
    setType(t);
    if (picked) setAmount((suggestedAmount(t, picked) / 100).toFixed(2));
  };

  // Recompute the canonical refund split whenever the booking or reason changes.
  useEffect(() => {
    if (!picked || manualOverride) {
      setSplit(null);
      return;
    }
    let cancelled = false;
    setSplitLoading(true);
    supabase
      .rpc('compute_refund_split', { _booking_id: picked.id, _reason: reasonCategory })
      .then(({ data, error }) => {
        if (cancelled) return;
        setSplitLoading(false);
        if (error) {
          setSplit(null);
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return;
        setSplit({
          student_cash_refund_cents: row.student_cash_refund_cents,
          instructor_forfeit_cents: row.instructor_forfeit_cents,
          platform_absorbed_cents: row.platform_absorbed_cents,
          requires_owner: row.requires_owner,
          hours_before_course: row.hours_before_course,
          rationale: row.rationale,
        });
        setAmount((row.student_cash_refund_cents / 100).toFixed(2));
        if (row.student_cash_refund_cents === 0) {
          setType('other');
        } else if (
          reasonCategory === 'instructor_no_show' ||
          reasonCategory === 'instructor_cancel' ||
          reasonCategory === 'fraud_safety'
        ) {
          setType('full');
        } else if (reasonCategory === 'student_cancel_timely') {
          setType('platform_fee');
        } else {
          setType('goodwill');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [picked, reasonCategory, manualOverride]);

  const reset = () => {
    setBookingQuery('');
    setBookingResults([]);
    setPicked(null);
    setType('platform_fee');
    setReasonCategory('student_cancel_timely');
    setSplit(null);
    setManualOverride(false);
    setAmount('');
    setReason('');
    setExternalRef('');
    setNotes('');
  };

  const submit = async () => {
    if (!user?.id || !picked) {
      toast.error('Pick a booking first');
      return;
    }
    const cents = Math.round(parseFloat(amount || '0') * 100);
    if (cents < 0) {
      toast.error('Amount cannot be negative');
      return;
    }
    // Hard cap: TacLink never credits more than the student paid online.
    if (cents > picked.online_total_cents) {
      toast.error('Credit cannot exceed what the student paid online', {
        description: `Max refundable: ${fmt(picked.online_total_cents)} ($25 platform fee + 10% deposit). The remaining 90% was paid in person to the instructor.`,
      });
      return;
    }
    if (!reason.trim()) {
      toast.error('Reason is required');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('refunds').insert({
      booking_id: picked.id,
      student_id: picked.student_id,
      issued_by: user.id,
      amount_cents: cents,
      refund_type: type,
      refund_reason_category: reasonCategory,
      instructor_forfeit_cents: split?.instructor_forfeit_cents ?? 0,
      platform_absorbed_cents: split?.platform_absorbed_cents ?? 0,
      hours_before_course: split?.hours_before_course ?? null,
      reason: reason.trim(),
      external_reference: externalRef.trim() || null,
      notes: manualOverride
        ? `MANUAL OVERRIDE. ${notes.trim() || ''}`.trim()
        : (notes.trim() || null),
      status: 'issued',
    });
    if (error) {
      toast.error('Could not issue credit', { description: error.message });
      setSubmitting(false);
      return;
    }
    if (cents > 0) {
      await supabase.from('notifications').insert({
        recipient_id: picked.student_id,
        type: 'refund_issued',
        title: `Cash refund: ${fmt(cents)}`,
        body: `${fmt(cents)} refunded to your payment method for ${picked.courseTitle}. Allow up to 5–10 business days to appear on your statement. Reason: ${reason.trim()}`,
        link: `/student/booking/${picked.id}`,
      });
      toast.success('Cash refund queued — student notified', {
        description: 'The Stripe refund will be processed by the next refund worker run.',
      });
    } else {
      toast.success('Decision recorded — no refund issued');
    }
    setSubmitting(false);
    setOpen(false);
    reset();
    load();
  };

  const reverse = async (id: string) => {
    if (!confirm('Mark this refund as reversed? This is for accounting only — it will NOT pull money back from the student\'s bank.')) return;
    const { error } = await supabase
      .from('refunds')
      .update({ status: 'reversed' })
      .eq('id', id);
    if (error) {
      toast.error('Could not reverse', { description: error.message });
      return;
    }
    toast.success('Refund marked reversed');
    load();
  };

  const retryStripeRefund = async (refundId: string) => {
    const { data, error } = await supabase.functions.invoke(
      `process-refund?env=${stripeEnvironment}`,
      { body: { refund_id: refundId } },
    );
    if (error) {
      toast.error('Stripe refund failed', { description: error.message });
      return;
    }
    const result = (data as any)?.results?.[0];
    if (result?.error) {
      toast.error('Stripe refund failed', { description: result.error });
    } else if (result?.stripe_refund_id) {
      toast.success('Stripe refund issued', { description: result.stripe_refund_id });
    } else {
      toast.success('Refund queue swept');
    }
    load();
  };

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" /> Refunds (Cash via Stripe)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Refunds are returned <span className="font-semibold text-foreground">in cash to the student's payment method via Stripe</span> within 48 hours.
            Per policy: instructor-fault cancellations refund $25 + 10%; student cancellations forfeit both.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setOpen(true)}>
            <DollarSign className="h-4 w-4 mr-2" /> Issue cash refund
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Refunds issued" value={String(totals.count)} />
        <Stat label="Total refunded" value={fmt(totals.issued)} />
        <Stat label="Last 200 records" value={String(refunds.length)} />
      </div>

      <div className="rounded-md border border-border overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Issued</th>
              <th className="text-left px-3 py-2">Student / Course</th>
              <th className="text-left px-3 py-2">Source</th>
              <th className="text-left px-3 py-2">Risk</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-right px-3 py-2">Amount</th>
              <th className="text-left px-3 py-2">Status / Window</th>
              <th className="text-right px-3 py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading credits…
                </td>
              </tr>
            ) : refunds.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">
                  No refund credits issued yet.
                </td>
              </tr>
            ) : (
              refunds.map((r) => {
                const windowOpen =
                  r.auto_issued &&
                  r.status === 'issued' &&
                  r.dispute_window_until &&
                  new Date(r.dispute_window_until) > new Date() &&
                  !r.instructor_disputed_at;
                return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.studentName}</div>
                    <div className="text-[11px] text-muted-foreground">{r.courseTitle}</div>
                    {r.reason && (
                      <div className="text-[10px] text-muted-foreground/80 italic mt-0.5 max-w-[260px] truncate">{r.reason}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.auto_issued ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/10 text-blue-600 border border-blue-500/30">
                        AI auto
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Manual</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {typeof r.risk_score === 'number' ? (
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.risk_score >= 60
                            ? 'bg-destructive/10 text-destructive border border-destructive/30'
                            : r.risk_score >= 30
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                        }`}
                        title={JSON.stringify(r.risk_factors ?? {}, null, 2)}
                      >
                        {r.risk_score}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs uppercase">{r.refund_type.replace('_', ' ')}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt(r.amount_cents)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          r.status === 'issued'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                            : r.status === 'reversed'
                              ? 'bg-muted text-muted-foreground border border-border'
                              : 'bg-destructive/10 text-destructive border border-destructive/30'
                        }`}
                      >
                        {r.status}
                      </span>
                      {windowOpen && (
                        <span className="text-[10px] text-amber-600">
                          Instructor can dispute until {new Date(r.dispute_window_until!).toLocaleString()}
                        </span>
                      )}
                      {r.instructor_disputed_at && (
                        <span className="text-[10px] text-destructive">
                          Disputed by instructor
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.status === 'issued' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => reverse(r.id)}
                        className="text-xs"
                      >
                        <Undo2 className="h-3 w-3 mr-1" /> Reverse
                      </Button>
                    )}
                  </td>
                </tr>
              );})
            )}
          </tbody>
        </table>
      </div>

      {/* Record refund dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Issue cash refund</DialogTitle>
            <DialogDescription>
              Find the booking and choose how much to refund. The amount is returned to the student's original payment method via Stripe (typically within 48 hours), and the student is notified automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!picked ? (
              <>
                <Label className="text-xs">Search by booking ID, student name, or course title</Label>
                <div className="flex gap-2">
                  <Input
                    value={bookingQuery}
                    onChange={(e) => setBookingQuery(e.target.value)}
                    placeholder="e.g. Jane Doe or Pistol Fundamentals"
                    onKeyDown={(e) => e.key === 'Enter' && searchBookings()}
                  />
                  <Button onClick={searchBookings} disabled={searching || !bookingQuery.trim()}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                {bookingResults.length > 0 && (
                  <ul className="border border-border rounded-md max-h-72 overflow-y-auto divide-y divide-border">
                    {bookingResults.map((b) => (
                      <li key={b.id}>
                        <button
                          onClick={() => onPick(b)}
                          className="w-full text-left px-3 py-2 hover:bg-muted/50"
                        >
                          <div className="font-medium text-sm">{b.studentName}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {b.courseTitle} · paid {fmt(b.online_total_cents)} · deposit {fmt(b.deposit_amount_cents)}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <div className="rounded-md border border-border p-3 bg-muted/30">
                  <div className="font-semibold text-sm">{picked.studentName}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {picked.courseTitle} · paid {fmt(picked.online_total_cents)} · deposit {fmt(picked.deposit_amount_cents)}
                  </div>
                  <button
                    onClick={() => setPicked(null)}
                    className="text-[11px] text-primary mt-1 hover:underline"
                  >
                    Change booking
                  </button>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Reason category</Label>
                  <Select value={reasonCategory} onValueChange={(v) => setReasonCategory(v as ReasonCategory)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(REASON_LABELS) as ReasonCategory[]).map((k) => (
                        <SelectItem key={k} value={k}>{REASON_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Auto-computed split preview */}
                {!manualOverride && split && (
                  <div className="rounded-md border border-border bg-muted/40 p-3 text-xs space-y-1">
                    <div className="font-semibold text-sm">Computed split</div>
                    <div>Student cash refund (Stripe): <span className="font-mono">{fmt(split.student_cash_refund_cents)}</span></div>
                    <div>Instructor forfeit: <span className="font-mono">{fmt(split.instructor_forfeit_cents)}</span></div>
                    <div>TacLink absorbs: <span className="font-mono">{fmt(split.platform_absorbed_cents)}</span></div>
                    {split.requires_owner && (
                      <div className="text-destructive font-medium">⚠ Owner review required for this reason</div>
                    )}
                    <div className="text-muted-foreground italic mt-1">{split.rationale}</div>
                  </div>
                )}
                {!manualOverride && splitLoading && (
                  <div className="text-xs text-muted-foreground">Computing split…</div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 flex items-end">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={manualOverride}
                        onChange={(e) => setManualOverride(e.target.checked)}
                      />
                      Manual override (custom amount)
                    </label>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Amount (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={!manualOverride}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Reason (shown to student)</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Course cancelled by instructor"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">External reference (optional)</Label>
                    <Input
                      value={externalRef}
                      onChange={(e) => setExternalRef(e.target.value)}
                      placeholder="Stripe re_… or check #"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Internal notes (optional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={1}
                      className="resize-none"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>
              Cancel
            </Button>
            <Button onClick={() => {
              if (!picked) { toast.error('Pick a booking first'); return; }
              const cents = Math.round(parseFloat(amount || '0') * 100);
              if (cents < 0) { toast.error('Amount cannot be negative'); return; }
              if (cents > picked.online_total_cents && !manualOverride) {
                toast.error('Amount exceeds what student paid online');
                return;
              }
              if (!reason.trim()) { toast.error('Reason is required'); return; }
              if (!manualOverride && split?.requires_owner) {
                if (!confirm('This reason normally requires owner review. Issue anyway?')) return;
              }
              setConfirmOpen(true);
            }} disabled={!picked || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Issue credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Issue cash refund</AlertDialogTitle>
            <AlertDialogDescription>
              Refund <span className="font-bold">{fmt(Math.round(parseFloat(amount || '0') * 100))}</span> ({type.replace('_', ' ')}) to {picked?.studentName} for "{picked?.courseTitle}". The amount returns to their original payment method via Stripe (typically within 48 hours). The student will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); setConfirmOpen(false); submit(); }} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Issue credit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border p-4">
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
  </div>
);

export default AdminRefunds;
