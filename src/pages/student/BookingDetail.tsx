import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, AlertTriangle, Star, Wallet, Loader2, CheckCircle2, ShieldCheck, RefreshCw, XCircle, UserX, MessageSquare } from 'lucide-react';
import { fmt } from '@/lib/fees';
import { QRCodeSVG } from 'qrcode.react';
import { AttendanceClaimResponse } from '@/components/student/AttendanceClaimResponse';
import { CancelGraceBadge } from '@/components/student/CancelGraceBadge';
import { WaiverAuditTrail } from '@/components/student/WaiverAuditTrail';
import { cancelDeadline } from '@/lib/cancellation';
import {
  REFUND_POLICY_BLURB,
  cancelButtonLabel,
  cancelConfirmMessage,
  instructorNoShowConfirmMessage,
} from '@/lib/refundCopy';
import { toast } from 'sonner';
import { paymentEnvironment } from '@/lib/paymentEnv';

type DepositStatus = 'not_required' | 'pending_payment' | 'held_in_escrow' | 'released' | 'refunded' | 'pending_send' | 'awaiting_confirmation' | 'confirmed' | 'expired';

type BookingRow = {
  id: string;
  status: string;
  course_price_cents: number;
  platform_fee_cents: number;
  instructor_deposit_cents: number;
  due_in_person_cents: number;
  online_total_cents: number;
  in_person_paid_at: string | null;
  course_id: string;
  deposit_status: DepositStatus;
  deposit_amount_cents: number;
  deposit_expires_at: string | null;
  booked_at: string | null;
  cancellation_cutoff_hours: number | null;
};

type CourseRow = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  instructor_id: string;
};

const BookingDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const attendanceRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [b, setB] = useState<BookingRow | null>(null);
  const [c, setC] = useState<CourseRow | null>(null);
  const [instructor, setInstructor] = useState<{ id: string; display_name: string | null; photo_url: string | null } | null>(null);
  const [signedToken, setSignedToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);

  const fetchSignedToken = async (bookingId: string) => {
    setTokenLoading(true);
    setTokenError(null);
    try {
      const { data, error } = await supabase.functions.invoke('sign-checkin-qr', {
        body: { bookingId },
      });
      if (error) throw error;
      if (!data?.token) throw new Error('No token returned');
      setSignedToken(data.token);
      setTokenExpiresAt(data.expiresAt ?? null);
    } catch (e: any) {
      setTokenError(e?.message ?? 'Could not load secure QR');
      setSignedToken(null);
    } finally {
      setTokenLoading(false);
    }
  };

  const reload = async () => {
    if (!id) return;
    setLoading(true);
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, course_price_cents, platform_fee_cents, instructor_deposit_cents, due_in_person_cents, online_total_cents, in_person_paid_at, course_id, deposit_status, deposit_amount_cents, deposit_expires_at, booked_at, cancellation_cutoff_hours')
      .eq('id', id)
      .maybeSingle();
    if (booking) {
      // Lazy auto-expire: if window passed without confirmation, mark expired + cancel.
      const row = booking as BookingRow;
      if (
        row.deposit_status === 'pending_send' &&
        row.deposit_expires_at &&
        new Date(row.deposit_expires_at).getTime() < Date.now()
      ) {
        await supabase
          .from('bookings')
          .update({ deposit_status: 'expired', status: 'cancelled' })
          .eq('id', row.id);
        row.deposit_status = 'expired';
        row.status = 'cancelled';
      }
      setB(row);
      const { data: course } = await supabase
        .from('courses')
        .select('id, title, starts_at, ends_at, address, city, state, instructor_id')
        .eq('id', row.course_id)
        .maybeSingle();
      setC((course as CourseRow) ?? null);
      if (course?.instructor_id) {
        const { data: inst } = await supabase
          .from('profiles')
          .select('id, display_name, photo_url')
          .eq('id', course.instructor_id)
          .maybeSingle();
        setInstructor(inst as any);
      }
      if (row.status === 'reserved' && (row.deposit_status === 'held_in_escrow' || row.deposit_status === 'confirmed')) {
        fetchSignedToken(row.id);
      }
    }
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id]);

  // Deep-link from notifications: ?focus=attendance scrolls to the claim card.
  useEffect(() => {
    if (loading || !b) return;
    if (searchParams.get('focus') !== 'attendance') return;
    const t = setTimeout(() => {
      attendanceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => clearTimeout(t);
  }, [loading, b, searchParams]);

  // Auto-refresh the signed QR a minute before it expires.
  useEffect(() => {
    if (!b || !tokenExpiresAt) return;
    const ms = Math.max(10_000, tokenExpiresAt - Date.now() - 60_000);
    const t = setTimeout(() => fetchSignedToken(b.id), ms);
    return () => clearTimeout(t);
  }, [b, tokenExpiresAt]);

  const [cancelling, setCancelling] = useState(false);
  const [reportingNoShow, setReportingNoShow] = useState(false);

  const triggerRefund = async (refundId: string | undefined) => {
    if (!refundId) return;
    try {
      await supabase.functions.invoke(`process-refund?env=${paymentEnvironment}`, {
        body: { refund_id: refundId },
      });
    } catch (e) {
      console.error('process-refund invoke failed', e);
    }
  };

  const cancelBooking = async () => {
    if (!b) return;
    const inGrace = !!cancelDeadline(c?.starts_at ?? null, b.booked_at, b.cancellation_cutoff_hours);
    if (!window.confirm(cancelConfirmMessage(inGrace))) return;
    setCancelling(true);
    const { data, error } = await supabase.rpc('student_cancel_booking', { _booking_id: b.id });
    setCancelling(false);
    if (error) {
      toast.error('Could not cancel booking', { description: error.message });
      return;
    }
    const refund = (data as any)?.student_refund_cents ?? 0;
    await triggerRefund((data as any)?.refund_id);
    toast.success('Booking cancelled', {
      description: `Refund of $${(refund / 100).toFixed(2)} on the way to your card.`,
    });
    reload();
  };

  const reportInstructorNoShow = async () => {
    if (!b) return;
    if (!window.confirm(instructorNoShowConfirmMessage())) return;
    setReportingNoShow(true);
    const { data, error } = await supabase.rpc('instructor_no_show_refund', { _booking_id: b.id });
    setReportingNoShow(false);
    if (error) {
      toast.error('Could not file report', { description: error.message });
      return;
    }
    const refund = (data as any)?.student_refund_cents ?? 0;
    await triggerRefund((data as any)?.refund_id);
    toast.success('Report filed — full refund issued', {
      description: `$${(refund / 100).toFixed(2)} on the way to your card.`,
    });
    reload();
  };

  if (loading) {
    return (
      <MobileShell withTabBar={false}>
        <PageHeader title="Booking Detail" back backTo="/student/bookings" />
        <div className="px-4 py-12 text-center text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading…
        </div>
      </MobileShell>
    );
  }

  if (!b || !c) {
    return (
      <MobileShell withTabBar={false}>
        <PageHeader title="Booking Detail" back backTo="/student/bookings" />
        <div className="px-4 py-12 text-center text-muted-foreground text-sm">Booking not found.</div>
      </MobileShell>
    );
  }

  const upcoming = b.status === 'reserved';
  const attended = b.status === 'attended';
  const dueInPerson = b.due_in_person_cents > 0 && !b.in_person_paid_at;
  const courseStarted =
    !!c.starts_at && new Date(c.starts_at).getTime() < Date.now();
  const inGraceWindow = !!cancelDeadline(c.starts_at, b.booked_at, b.cancellation_cutoff_hours);
  const isCancelled = b.status === 'cancelled';
  // Full refund if the deposit was refunded (timely cancel or instructor cancel),
  // otherwise late-cancel rule: 90% of the course price returned.
  const refundCents = isCancelled
    ? (b.deposit_status === 'refunded'
        ? b.online_total_cents
        : Math.round(b.course_price_cents * 0.9))
    : 0;

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="Booking Detail" back backTo="/student/bookings" />
      <div className="px-4 py-4 space-y-4">
        <div className="tactical-card p-4">
          <h2 className="font-bold mb-3">{c.title}</h2>
          <div className="space-y-2 text-xs text-muted-foreground">
            {c.starts_at && (
              <>
                <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-primary" />{new Date(c.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-primary" />{new Date(c.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{c.ends_at ? ` – ${new Date(c.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
              </>
            )}
        {!isCancelled && (
          <div className="tactical-card p-4">
            <h2 className="font-bold mb-3">{c.title}</h2>
            <div className="space-y-2 text-xs text-muted-foreground">
              {c.starts_at && (
                <>
                  <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-primary" />{new Date(c.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                  <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-primary" />{new Date(c.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{c.ends_at ? ` – ${new Date(c.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
                </>
              )}
              {(c.address || c.city) && (
                <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary" />{[c.address, c.city, c.state].filter(Boolean).join(', ')}</div>
              )}
            </div>
          </div>
        )}

        {!isCancelled && instructor && (
          <div className="tactical-card p-4 flex items-center gap-3">
            {instructor.photo_url ? (
              <img src={instructor.photo_url} alt={instructor.display_name ?? 'Instructor'} className="h-12 w-12 rounded-full object-cover border-2 border-primary" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-muted border-2 border-primary" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Your instructor</div>
              <div className="font-bold truncate">{instructor.display_name ?? 'Instructor'}</div>
            </div>
            <Button
              size="sm"
              onClick={() => nav(`/student/messages/${instructor.id}`)}
              className="h-9 bg-primary text-primary-foreground font-bold"
            >
              <MessageSquare className="h-4 w-4 mr-1.5" /> Message
            </Button>
          </div>
        )}

        {/* Payment summary */}
        <div className="tactical-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5" /> {isCancelled ? 'Refund' : 'Payment'}
          </div>
          {isCancelled ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Refund amount</span>
                <span className="text-2xl font-black text-emerald-500">{fmt(refundCents)}</span>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {refundCents === b.online_total_cents
                  ? 'Full refund — $25 platform fee + course price returned to your card.'
                  : '90% of course price refunded (late cancel — instructor keeps 10%, $25 fee non-refundable).'}
                {' '}Posts back in <strong className="text-foreground">5–10 business days</strong> depending on your bank.
              </div>
            </div>
          ) : (
          <div className="space-y-1.5 text-sm">
            <Row label="Course price" value={fmt(b.course_price_cents)} muted />
            <Row label="TacLink platform fee" value={fmt(b.platform_fee_cents)} muted />
            <div className="border-t border-border pt-2 flex justify-between">
              <span>Charged online</span>
              <span className="font-bold">{fmt(b.online_total_cents)}</span>
            </div>
            <Row
              label={
                b.deposit_status === 'released'
                  ? 'Deposit (10%) — released to instructor'
                  : b.deposit_status === 'held_in_escrow'
                    ? 'Deposit (10%) — held in escrow'
                    : b.deposit_status === 'pending_payment'
                      ? 'Deposit (10%) — payment pending'
                      : b.deposit_status === 'refunded'
                        ? 'Deposit (10%) — refunded'
                        : 'Deposit (10%)'
              }
              value={fmt(b.deposit_amount_cents)}
              muted
            />
            {dueInPerson && (
              <div className="mt-3 rounded-md border border-primary/40 bg-primary/10 p-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-primary font-bold">Due in person</div>
                  <div className="text-xs text-muted-foreground">Pay the instructor at the course</div>
                </div>
                <div className="text-lg font-black text-primary">{fmt(b.due_in_person_cents)}</div>
              </div>
            )}
            {b.in_person_paid_at && (
              <div className="mt-3 text-xs text-muted-foreground">In-person balance marked paid {new Date(b.in_person_paid_at).toLocaleDateString()}.</div>
            )}
          </div>
          )}
        </div>

        {!isCancelled && (
          <div ref={attendanceRef} id="attendance-claim" className="scroll-mt-24">
            <AttendanceClaimResponse bookingId={b.id} />
          </div>
        )}

        {!isCancelled && <WaiverAuditTrail bookingId={b.id} />}

        {upcoming && (b.deposit_status === 'held_in_escrow' || b.deposit_status === 'confirmed') && (
          <div className="tactical-card p-5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-3">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Signed Check-In QR</div>
            </div>
            <div className="mx-auto bg-white p-4 rounded-sm w-fit relative">
              {tokenLoading && !signedToken ? (
                <div className="h-[208px] w-[208px] flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : signedToken ? (
                <QRCodeSVG value={signedToken} size={208} level="M" includeMargin={false} />
              ) : (
                <div className="h-[208px] w-[208px] flex flex-col items-center justify-center text-xs text-destructive p-4 text-center">
                  <AlertTriangle className="h-5 w-5 mb-2" />
                  {tokenError ?? 'Could not load secure QR'}
                </div>
              )}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
              Cryptographically signed — bound to this booking and today's date. Cannot be forged, shared, or used on the wrong day.
            </p>
            <button
              type="button"
              onClick={() => fetchSignedToken(b.id)}
              disabled={tokenLoading}
              className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-primary hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${tokenLoading ? 'animate-spin' : ''}`} />
              {tokenLoading ? 'Refreshing' : 'Refresh QR'}
            </button>
          </div>
        )}

        {attended && (
          <div className="tactical-card p-4 flex items-center gap-3 border-success/30 bg-success/5">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div className="text-sm font-semibold">You're checked in for this course.</div>
          </div>
        )}

        {upcoming && (
          <CancelGraceBadge
            variant="card"
            startsAt={c.starts_at}
            bookedAt={b.booked_at}
            cutoffHours={b.cancellation_cutoff_hours}
          />
        )}

        {b.status === 'cancelled' || b.deposit_status === 'refunded' ? (
          <div className="tactical-card border-emerald-500/30 bg-emerald-500/5 p-3 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Refund on the way.</strong>{' '}
              Your refund has been issued to the original card. Per our refund policy, the
              platform fee portion typically posts back within{' '}
              <strong className="text-foreground">1–3 business days</strong>, and the course
              price portion within <strong className="text-foreground">5–10 business days</strong>,
              depending on your bank. If the instructor cancelled, you'll receive a full
              refund ($25 + course price) within 48 hours.
            </div>
          </div>
        ) : (
          <div className="tactical-card border-primary/20 bg-primary/5 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Cancellation policy:</strong>{' '}
              {REFUND_POLICY_BLURB}
            </div>
          </div>
        )}

        {upcoming && (
          <Button
            onClick={cancelBooking}
            disabled={cancelling}
            variant="outline"
            className="w-full h-12 font-bold border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            {cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
            {cancelButtonLabel(inGraceWindow)}
          </Button>
        )}

        {upcoming && courseStarted && (
          <Button
            onClick={reportInstructorNoShow}
            disabled={reportingNoShow}
            variant="outline"
            className="w-full h-12 font-bold border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            {reportingNoShow ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
            Report instructor no-show
          </Button>
        )}

        {attended && (
          <Button onClick={() => nav(`/student/review/${b.id}`)} className="w-full h-12 bg-primary text-primary-foreground font-bold">
            <Star className="mr-2" /> Leave a Review
          </Button>
        )}
      </div>
    </MobileShell>
  );
};

const Row = ({ label, value, muted }: { label: string; value: string; muted?: boolean }) => (
  <div className="flex justify-between">
    <span className={muted ? 'text-muted-foreground' : ''}>{label}</span>
    <span className={muted ? 'text-muted-foreground' : 'font-semibold'}>{value}</span>
  </div>
);

export default BookingDetail;
