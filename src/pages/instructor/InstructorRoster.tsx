import { useEffect, useMemo, useState } from 'react';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { InstructorTabBar } from '@/components/InstructorTabBar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Users, CalendarDays, CheckCircle2, XCircle, Clock, RotateCcw, Loader2, FileText, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CourseWaiverDialog } from '@/components/instructor/CourseWaiverDialog';
import { HowPaymentsWorkCard } from '@/components/HowPaymentsWorkCard';

type BookingStatus = 'reserved' | 'attended' | 'cancelled' | 'no_show';

type RosterRow = {
  bookingId: string;
  status: string;
  bookedAt: string;
  studentId: string;
  studentName: string;
  studentPhoto: string | null;
  courseId: string;
  courseTitle: string;
  startsAt: string | null;
  depositStatus: string;
  depositAmountCents: number;
  depositMethod: string | null;
  depositHandleUsed: string | null;
  depositSentAt: string | null;
  depositExpiresAt: string | null;
};

const statusStyles: Record<string, string> = {
  reserved: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  attended: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
  no_show: 'bg-destructive/10 text-destructive border-destructive/30',
};

const statusIcon: Record<string, any> = {
  reserved: Clock,
  attended: CheckCircle2,
  cancelled: XCircle,
  no_show: XCircle,
};

const depositStyles: Record<string, string> = {
  pending_send: 'bg-muted text-muted-foreground border-border',
  awaiting_confirmation: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  confirmed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  expired: 'bg-destructive/10 text-destructive border-destructive/30',
};

const depositLabel: Record<string, string> = {
  pending_send: 'Deposit not sent',
  awaiting_confirmation: 'Deposit awaiting',
  confirmed: 'Deposit received',
  expired: 'Deposit expired',
};

const filters = ['Upcoming', 'Deposits', 'Attended', 'Cancelled', 'No-show', 'All'] as const;

const InstructorRoster = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<typeof filters[number]>('Upcoming');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [waiverCourseId, setWaiverCourseId] = useState<string | null>(null);

  const updateStatus = async (bookingId: string, next: BookingStatus) => {
    setUpdatingId(bookingId);
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.bookingId === bookingId ? { ...r, status: next } : r)));
    const patch = {
      status: next,
      attended_at: next === 'attended' ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from('bookings').update(patch).eq('id', bookingId);
    setUpdatingId(null);
    if (error) {
      setRows(prev);
      toast.error('Could not update status', { description: error.message });
    } else {
      toast.success(`Marked as ${next.replace('_', ' ')}`);
    }
  };

  const confirmDeposit = async (bookingId: string) => {
    const target = rows.find((r) => r.bookingId === bookingId);
    if (!target) return;
    // Lock: only allow confirming an awaiting deposit. Confirmed/expired are immutable here.
    if (target.depositStatus === 'confirmed') {
      toast.info('Deposit already confirmed');
      return;
    }
    if (target.depositStatus === 'expired') {
      toast.error('Deposit window expired — booking was auto-cancelled');
      return;
    }
    if (target.depositStatus !== 'awaiting_confirmation') {
      toast.error('Student has not marked the deposit as sent yet');
      return;
    }
    setUpdatingId(bookingId);
    const prev = rows;
    setRows((rs) =>
      rs.map((r) =>
        r.bookingId === bookingId ? { ...r, depositStatus: 'confirmed' } : r,
      ),
    );
    // Guarded update — refuses to overwrite an already-confirmed or expired row.
    const { data, error } = await supabase
      .from('bookings')
      .update({
        deposit_status: 'confirmed',
        deposit_confirmed_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .eq('deposit_status', 'awaiting_confirmation')
      .select('id')
      .maybeSingle();
    setUpdatingId(null);
    if (error) {
      setRows(prev);
      toast.error('Could not confirm deposit', { description: error.message });
    } else if (!data) {
      setRows(prev);
      toast.error('Deposit state changed — refresh and try again');
    } else {
      toast.success('Deposit confirmed — booking locked in');
    }
  };

  // Lazy auto-expire: any pending_send / awaiting_confirmation booking past its
  // 24-hour deadline gets flipped to expired + cancelled.
  const expireOverdue = async (candidates: RosterRow[]) => {
    const nowMs = Date.now();
    const overdue = candidates.filter(
      (r) =>
        r.depositExpiresAt &&
        new Date(r.depositExpiresAt).getTime() < nowMs &&
        (r.depositStatus === 'pending_send' || r.depositStatus === 'awaiting_confirmation'),
    );
    if (overdue.length === 0) return candidates;
    const ids = overdue.map((r) => r.bookingId);
    await supabase
      .from('bookings')
      .update({ deposit_status: 'expired', status: 'cancelled' })
      .in('id', ids)
      .in('deposit_status', ['pending_send', 'awaiting_confirmation']);
    return candidates.map((r) =>
      ids.includes(r.bookingId)
        ? { ...r, depositStatus: 'expired', status: 'cancelled' }
        : r,
    );
  };

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title, starts_at')
        .eq('instructor_id', user.id);
      const courseIds = (courses ?? []).map((c) => c.id);
      if (courseIds.length === 0) {
        if (!cancelled) {
          setRows([]);
          setLoading(false);
        }
        return;
      }
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, status, booked_at, student_id, course_id, deposit_status, deposit_amount_cents, deposit_method, deposit_handle_used, deposit_sent_at, deposit_expires_at')
        .in('course_id', courseIds)
        .order('booked_at', { ascending: false });
      const studentIds = Array.from(new Set((bookings ?? []).map((b) => b.student_id)));
      const { data: profiles } = studentIds.length
        ? await supabase
            .from('profiles')
            .select('id, display_name, photo_url')
            .in('id', studentIds)
        : { data: [] as any[] };
      const courseMap = new Map((courses ?? []).map((c) => [c.id, c]));
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const result: RosterRow[] = (bookings ?? []).map((b: any) => {
        const c = courseMap.get(b.course_id);
        const p = profileMap.get(b.student_id);
        return {
          bookingId: b.id,
          status: b.status,
          bookedAt: b.booked_at,
          studentId: b.student_id,
          studentName: p?.display_name ?? 'Student',
          studentPhoto: p?.photo_url ?? null,
          courseId: b.course_id,
          courseTitle: c?.title ?? 'Course',
          startsAt: c?.starts_at ?? null,
          depositStatus: b.deposit_status ?? 'pending_send',
          depositAmountCents: b.deposit_amount_cents ?? 0,
          depositMethod: b.deposit_method ?? null,
          depositHandleUsed: b.deposit_handle_used ?? null,
          depositSentAt: b.deposit_sent_at ?? null,
          depositExpiresAt: b.deposit_expires_at ?? null,
        };
      });
      if (!cancelled) {
        const reconciled = await expireOverdue(result);
        if (!cancelled) {
          setRows(reconciled);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const now = Date.now();
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const startMs = r.startsAt ? new Date(r.startsAt).getTime() : 0;
      if (tab === 'Upcoming')
        return r.status === 'reserved' && (!startMs || startMs >= now);
      if (tab === 'Deposits')
        return r.status !== 'cancelled' && r.depositStatus === 'awaiting_confirmation';
      if (tab === 'Attended') return r.status === 'attended';
      if (tab === 'Cancelled') return r.status === 'cancelled';
      if (tab === 'No-show') return r.status === 'no_show';
      return true;
    });
  }, [rows, tab, now]);

  const counts = useMemo(() => {
    const c = { Upcoming: 0, Deposits: 0, Attended: 0, Cancelled: 0, 'No-show': 0, All: rows.length };
    rows.forEach((r) => {
      const startMs = r.startsAt ? new Date(r.startsAt).getTime() : 0;
      if (r.status === 'reserved' && (!startMs || startMs >= now)) c.Upcoming++;
      if (r.status !== 'cancelled' && r.depositStatus === 'awaiting_confirmation') c.Deposits++;
      if (r.status === 'attended') c.Attended++;
      if (r.status === 'cancelled') c.Cancelled++;
      if (r.status === 'no_show') c['No-show']++;
    });
    return c as Record<typeof filters[number], number>;
  }, [rows, now]);

  const grouped = useMemo(() => {
    const m = new Map<string, { title: string; startsAt: string | null; rows: RosterRow[] }>();
    filtered.forEach((r) => {
      if (!m.has(r.courseId))
        m.set(r.courseId, { title: r.courseTitle, startsAt: r.startsAt, rows: [] });
      m.get(r.courseId)!.rows.push(r);
    });
    return Array.from(m.entries());
  }, [filtered]);

  const totalStudents = filtered.length;

  return (
    <MobileShell>
      <PageHeader title="Roster" />
      <div className="px-4 pt-3 pb-24 space-y-4">
        <HowPaymentsWorkCard audience="instructor" />
        <div className="rounded-md border border-border bg-card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              {tab} students
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
          {filters.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider transition-colors',
                tab === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground',
              )}
            >
              {t}
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px]',
                  tab === t ? 'bg-primary-foreground/20' : 'bg-muted',
                )}
              >
                {counts[t]}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-12">Loading roster…</div>
        ) : grouped.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-12">
            No students in this view yet.
          </div>
        ) : (
          grouped.map(([courseId, group]) => (
            <div key={courseId} className="rounded-md border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{group.title}</div>
                  {group.startsAt && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <CalendarDays className="h-3 w-3" />
                      {new Date(group.startsAt).toLocaleString()}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {group.rows.length} student{group.rows.length === 1 ? '' : 's'}
                  </div>
                </div>
                <button
                  onClick={() => setWaiverCourseId(courseId)}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-primary/30 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/20"
                >
                  <FileText className="h-3 w-3" /> Waiver
                </button>
              </div>
              <ul className="divide-y divide-border">
                {group.rows.map((r) => {
                  const Icon = statusIcon[r.status] ?? Clock;
                  const busy = updatingId === r.bookingId;
                  return (
                    <li key={r.bookingId} className="px-4 py-3 space-y-2">
                      <div className="flex items-center gap-3">
                        {r.studentPhoto ? (
                          <img
                            src={r.studentPhoto}
                            alt={r.studentName}
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                            {r.studentName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{r.studentName}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Booked {new Date(r.bookedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider',
                            statusStyles[r.status] ?? statusStyles.reserved,
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {r.status.replace('_', ' ')}
                        </span>
                      </div>
                      {r.depositAmountCents > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pl-12">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider',
                              depositStyles[r.depositStatus] ?? depositStyles.pending_send,
                            )}
                          >
                            <DollarSign className="h-3 w-3" />
                            {depositLabel[r.depositStatus] ?? r.depositStatus}
                            {' · $'}
                            {(r.depositAmountCents / 100).toFixed(2)}
                          </span>
                          {r.depositMethod && r.depositHandleUsed && (
                            <span className="text-[10px] text-muted-foreground">
                              via {r.depositMethod} {r.depositHandleUsed}
                            </span>
                          )}
                          {r.depositStatus === 'awaiting_confirmation' && (
                            <button
                              disabled={busy}
                              onClick={() => confirmDeposit(r.bookingId)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 text-[11px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 disabled:opacity-50"
                            >
                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              Mark received
                            </button>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5 pl-12">
                        {r.status !== 'attended' && (
                          <button
                            disabled={busy}
                            onClick={() => updateStatus(r.bookingId, 'attended')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 text-[11px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            Attended
                          </button>
                        )}
                        {r.status !== 'no_show' && (
                          <button
                            disabled={busy}
                            onClick={() => updateStatus(r.bookingId, 'no_show')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-destructive/40 bg-destructive/10 text-destructive text-[11px] font-bold uppercase tracking-wider hover:bg-destructive/20 disabled:opacity-50"
                          >
                            <XCircle className="h-3 w-3" />
                            No-show
                          </button>
                        )}
                        {r.status !== 'cancelled' && (
                          <button
                            disabled={busy}
                            onClick={() => updateStatus(r.bookingId, 'cancelled')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-border bg-muted text-muted-foreground text-[11px] font-bold uppercase tracking-wider hover:bg-muted/70 disabled:opacity-50"
                          >
                            <XCircle className="h-3 w-3" />
                            Cancel
                          </button>
                        )}
                        {r.status !== 'reserved' && (
                          <button
                            disabled={busy}
                            onClick={() => updateStatus(r.bookingId, 'reserved')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-border bg-card text-muted-foreground text-[11px] font-bold uppercase tracking-wider hover:bg-muted disabled:opacity-50"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Reset
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
      <InstructorTabBar />
      {waiverCourseId && (
        <CourseWaiverDialog
          open={!!waiverCourseId}
          onOpenChange={(o) => !o && setWaiverCourseId(null)}
          courseId={waiverCourseId}
        />
      )}
    </MobileShell>
  );
};

export default InstructorRoster;
