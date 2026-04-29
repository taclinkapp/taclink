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

type RefundType = 'platform_fee' | 'deposit' | 'full' | 'partial' | 'goodwill' | 'other';
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
        return b.online_total_cents + b.deposit_amount_cents;
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

  const reset = () => {
    setBookingQuery('');
    setBookingResults([]);
    setPicked(null);
    setType('platform_fee');
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
    if (!cents || cents <= 0) {
      toast.error('Enter a refund amount');
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
      reason: reason.trim(),
      external_reference: externalRef.trim() || null,
      notes: notes.trim() || null,
      status: 'issued',
    });
    if (error) {
      toast.error('Could not record refund', { description: error.message });
      setSubmitting(false);
      return;
    }
    // Notify student — refunds are issued as in-app credit, not cash.
    await supabase.from('notifications').insert({
      recipient_id: picked.student_id,
      type: 'refund_issued',
      title: `In-app credit issued: ${fmt(cents)}`,
      body: `${fmt(cents)} credit added to your account for ${picked.courseTitle}. Apply it to your next booking. Reason: ${reason.trim()}`,
      link: `/student/booking/${picked.id}`,
    });
    toast.success('Refund credit issued — student notified');
    setSubmitting(false);
    setOpen(false);
    reset();
    load();
  };

  const reverse = async (id: string) => {
    if (!confirm('Mark this refund as reversed? Use only if the payment was clawed back.')) return;
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

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" /> Refunds (App Credit)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All booking-fee refunds are issued as <span className="font-semibold text-foreground">in-app credit</span> the student can apply to a future course. No cash is returned. The student is notified automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setOpen(true)}>
            <DollarSign className="h-4 w-4 mr-2" /> Issue refund credit
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Credits issued" value={String(totals.count)} />
        <Stat label="Total credit issued" value={fmt(totals.issued)} />
        <Stat label="Last 200 records" value={String(refunds.length)} />
      </div>

      <div className="rounded-md border border-border overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Issued</th>
              <th className="text-left px-3 py-2">Student / Course</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-right px-3 py-2">Amount</th>
              <th className="text-left px-3 py-2">Reason</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading credits…
                </td>
              </tr>
            ) : refunds.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground">
                  No refund credits issued yet.
                </td>
              </tr>
            ) : (
              refunds.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.studentName}</div>
                    <div className="text-[11px] text-muted-foreground">{r.courseTitle}</div>
                  </td>
                  <td className="px-3 py-2 text-xs uppercase">{r.refund_type.replace('_', ' ')}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt(r.amount_cents)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[260px] truncate">{r.reason}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        r.status === 'issued'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                          : r.status === 'reversed'
                            ? 'bg-muted text-muted-foreground border border-border'
                            : 'bg-destructive/10 text-destructive border border-destructive/30'
                      }`}
                    >
                      {r.status}
                    </span>
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Record refund dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Issue refund as in-app credit</DialogTitle>
            <DialogDescription>
              Find the booking and choose how much credit to issue. The student receives an in-app credit (no cash refund) and is notified automatically.
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Credit type</Label>
                    <Select value={type} onValueChange={(v) => onTypeChange(v as RefundType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="platform_fee">Platform fee ($25)</SelectItem>
                        <SelectItem value="deposit">Deposit (10%)</SelectItem>
                        <SelectItem value="full">Full (online + deposit)</SelectItem>
                        <SelectItem value="partial">Partial (custom amount)</SelectItem>
                        <SelectItem value="goodwill">Goodwill credit</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Amount (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
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
              if (!cents || cents <= 0) { toast.error('Enter a refund amount'); return; }
              if (!reason.trim()) { toast.error('Reason is required'); return; }
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
            <AlertDialogTitle>Issue in-app credit</AlertDialogTitle>
            <AlertDialogDescription>
              Issue <span className="font-bold">{fmt(Math.round(parseFloat(amount || '0') * 100))}</span> as in-app credit ({type.replace('_', ' ')}) to {picked?.studentName} for "{picked?.courseTitle}". This is NOT a cash refund — it's a credit toward a future booking. The student will be notified.
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
