import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { InstructorTabBar } from '@/components/InstructorTabBar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '@/lib/fees';
import { cn } from '@/lib/utils';

type StuckBooking = {
  bookingId: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  depositCents: number;
  depositMethod: string | null;
  depositHandleUsed: string | null;
  depositSentAt: string | null;
  depositExpiresAt: string | null;
  hoursOverdue: number;
  isAdmin: boolean;
};

const DepositReview = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<StuckBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);

    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const admin = !!roleRows?.some((r) => r.role === 'admin');
    setIsAdmin(admin);

    // Instructors see their own courses; admin sees everything.
    let courseIds: string[] | null = null;
    if (!admin) {
      const { data: courses } = await supabase
        .from('courses')
        .select('id')
        .eq('instructor_id', user.id);
      courseIds = (courses ?? []).map((c) => c.id);
      if (courseIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }
    }

    let q = supabase
      .from('bookings')
      .select(
        'id, student_id, course_id, deposit_amount_cents, deposit_method, deposit_handle_used, deposit_sent_at, deposit_expires_at',
      )
      .eq('deposit_status', 'awaiting_confirmation');
    if (courseIds) q = q.in('course_id', courseIds);

    const { data: bookings, error } = await q;
    if (error) {
      toast.error('Could not load review queue', { description: error.message });
      setLoading(false);
      return;
    }

    const stuckRaw = (bookings ?? []).filter(
      (b: any) =>
        b.deposit_expires_at &&
        new Date(b.deposit_expires_at).getTime() < Date.now(),
    );

    if (stuckRaw.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const studentIds = Array.from(new Set(stuckRaw.map((b: any) => b.student_id)));
    const courseIdsForLookup = Array.from(new Set(stuckRaw.map((b: any) => b.course_id)));
    const [{ data: profiles }, { data: courses2 }] = await Promise.all([
      supabase.from('profiles').select('id, display_name').in('id', studentIds),
      supabase.from('courses').select('id, title').in('id', courseIdsForLookup),
    ]);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const courseMap = new Map((courses2 ?? []).map((c: any) => [c.id, c]));

    const result: StuckBooking[] = stuckRaw.map((b: any) => {
      const overdueMs = Date.now() - new Date(b.deposit_expires_at).getTime();
      return {
        bookingId: b.id,
        studentId: b.student_id,
        studentName: profileMap.get(b.student_id)?.display_name ?? 'Student',
        courseId: b.course_id,
        courseTitle: courseMap.get(b.course_id)?.title ?? 'Course',
        depositCents: b.deposit_amount_cents ?? 0,
        depositMethod: b.deposit_method,
        depositHandleUsed: b.deposit_handle_used,
        depositSentAt: b.deposit_sent_at,
        depositExpiresAt: b.deposit_expires_at,
        hoursOverdue: Math.floor(overdueMs / 3_600_000),
        isAdmin: admin,
      };
    });

    setRows(
      result.sort(
        (a, b) =>
          new Date(b.depositExpiresAt!).getTime() -
          new Date(a.depositExpiresAt!).getTime(),
      ),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const overrideConfirm = async (row: StuckBooking) => {
    if (!confirm(`Override and confirm ${row.studentName}'s deposit of ${fmt(row.depositCents)}? This re-activates the booking.`)) return;
    setBusyId(row.bookingId);
    const { error } = await supabase
      .from('bookings')
      .update({
        deposit_status: 'confirmed',
        deposit_confirmed_at: new Date().toISOString(),
        status: 'reserved',
      })
      .eq('id', row.bookingId)
      .eq('deposit_status', 'awaiting_confirmation');
    if (error) {
      toast.error('Override failed', { description: error.message });
      setBusyId(null);
      return;
    }
    await supabase.from('notifications').insert({
      recipient_id: row.studentId,
      type: 'deposit_confirmed',
      title: 'Deposit confirmed (manual override)',
      body: `Your deposit for ${row.courseTitle} was confirmed. Your seat is locked in.`,
      link: `/student/booking/${row.bookingId}`,
    });
    toast.success('Override applied — student notified');
    setBusyId(null);
    load();
  };

  const rejectExpire = async (row: StuckBooking) => {
    if (!confirm(`Reject ${row.studentName}'s deposit and cancel the booking? The student will be notified.`)) return;
    setBusyId(row.bookingId);
    const { error } = await supabase
      .from('bookings')
      .update({ deposit_status: 'expired', status: 'cancelled' })
      .eq('id', row.bookingId)
      .eq('deposit_status', 'awaiting_confirmation');
    if (error) {
      toast.error('Could not reject', { description: error.message });
      setBusyId(null);
      return;
    }
    await supabase.from('notifications').insert({
      recipient_id: row.studentId,
      type: 'deposit_rejected',
      title: 'Deposit not confirmed',
      body: `Your deposit for ${row.courseTitle} could not be verified and the booking was cancelled.`,
      link: `/student/booking/${row.bookingId}`,
    });
    toast.success('Booking cancelled — student notified');
    setBusyId(null);
    load();
  };

  const total = useMemo(
    () => rows.reduce((s, r) => s + r.depositCents, 0),
    [rows],
  );

  return (
    <MobileShell>
      <PageHeader title="Deposit Review" back />
      <div className="px-4 pt-3 pb-24 space-y-4">
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Stuck deposits.</strong> These bookings are still in <em>awaiting confirmation</em> after their 24-hour window closed. Confirm if you actually received the money, or reject to cancel the booking. {isAdmin && <span className="block mt-1 text-amber-600 font-bold">Admin view: showing every instructor.</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Stuck bookings" value={String(rows.length)} />
          <StatCard label="At risk" value={fmt(total)} />
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
            Nothing stuck — every deposit is on track.
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li
                key={r.bookingId}
                className="rounded-md border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-md bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {r.studentName}
                    </div>
                    <Link
                      to={`/instructor/courses/${r.courseId}`}
                      className="text-[11px] text-muted-foreground hover:text-primary truncate block"
                    >
                      {r.courseTitle}
                    </Link>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase tracking-wider shrink-0">
                    <AlertTriangle className="h-3 w-3" />
                    {r.hoursOverdue}h overdue
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <Detail label="Amount" value={fmt(r.depositCents)} bold />
                  <Detail
                    label="Method"
                    value={
                      r.depositMethod
                        ? `${r.depositMethod}${r.depositHandleUsed ? ` ${r.depositHandleUsed}` : ''}`
                        : '—'
                    }
                  />
                  <Detail
                    label="Marked sent"
                    value={
                      r.depositSentAt
                        ? new Date(r.depositSentAt).toLocaleString()
                        : '—'
                    }
                  />
                  <Detail
                    label="Expired"
                    value={
                      r.depositExpiresAt
                        ? new Date(r.depositExpiresAt).toLocaleString()
                        : '—'
                    }
                  />
                </dl>

                <div className="flex gap-2">
                  <Button
                    onClick={() => overrideConfirm(r)}
                    disabled={busyId === r.bookingId}
                    className={cn(
                      'flex-1 h-10 text-xs font-bold uppercase tracking-wider',
                      'bg-emerald-500/10 border border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/20',
                    )}
                    variant="ghost"
                  >
                    {busyId === r.bookingId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <DollarSign className="h-3.5 w-3.5 mr-1" />
                    )}
                    Confirm anyway
                  </Button>
                  <Button
                    onClick={() => rejectExpire(r)}
                    disabled={busyId === r.bookingId}
                    className="flex-1 h-10 text-xs font-bold uppercase tracking-wider bg-destructive/10 border border-destructive/40 text-destructive hover:bg-destructive/20"
                    variant="ghost"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Reject & cancel
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <InstructorTabBar />
    </MobileShell>
  );
};

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border bg-card p-3">
    <div className="text-xl font-bold">{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
      {label}
    </div>
  </div>
);

const Detail = ({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) => (
  <div className="flex flex-col">
    <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">
      {label}
    </dt>
    <dd className={cn('truncate', bold && 'font-bold text-foreground')}>
      {value}
    </dd>
  </div>
);

export default DepositReview;
