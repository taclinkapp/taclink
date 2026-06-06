import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { sendAppEmail } from '@/lib/appEmail';
import { cancelDeadline } from '@/lib/cancellation';

type DepositStatus =
  | 'not_required'
  | 'pending_payment'
  | 'held_in_escrow'
  | 'released'
  | 'refunded'
  | 'pending_send'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'expired';

type BookingRow = {
  id: string;
  deposit_status: DepositStatus;
  online_total_cents: number;
  course_id: string;
  student_id: string;
  booked_at: string | null;
  cancellation_cutoff_hours: number | null;
};

const POLL_MS = 2000;
const MAX_WAIT_MS = 60_000;

/**
 * Post-checkout return page.
 *
 * The payment processor redirects here right after the buyer submits payment.
 * The webhook flips the booking to `held_in_escrow` asynchronously, so we poll
 * the booking row until the status updates (or we time out). We also send the
 * "booking confirmed" email here — once — so abandoned checkouts never email.
 */
const CheckoutReturn = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const emailSent = useRef(false);

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      // Ownership filter: only the booking's owner can read it through this page.
      const { data, error: err } = await supabase
        .from('bookings')
        .select('id, deposit_status, online_total_cents, course_id, student_id, booked_at, cancellation_cutoff_hours')
        .eq('id', id)
        .eq('student_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (err) {
        setError(err.message);
        return;
      }
      if (!data) {
        setError('Booking not found');
        return;
      }
      setBooking(data as BookingRow);
      const status = (data as BookingRow).deposit_status;
      if (status === 'held_in_escrow' || status === 'released') {
        // Fire confirmation email exactly once, after payment is real.
        if (!emailSent.current && user.email) {
          emailSent.current = true;
          (async () => {
            const { data: course } = await supabase
              .from('courses')
              .select('title, starts_at, city, state, instructor_id')
              .eq('id', (data as BookingRow).course_id)
              .maybeSingle();
            const { data: instructorRows } = course?.instructor_id
              ? await (supabase as any).rpc('get_public_instructor_profile', { _id: course.instructor_id })
              : { data: null as any };
            const instructor = Array.isArray(instructorRows) ? instructorRows[0] ?? null : instructorRows;

            const startsAt = (course as any)?.starts_at ?? null;
            const startDate = startsAt
              ? new Date(startsAt).toLocaleString(undefined, {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                })
              : undefined;
            const location = [(course as any)?.city, (course as any)?.state].filter(Boolean).join(', ') || undefined;
            const cutoffHours = (data as BookingRow).cancellation_cutoff_hours;
            const deadline = cancelDeadline(startsAt, (data as BookingRow).booked_at, cutoffHours);
            const deadlineStr = deadline
              ? deadline.toLocaleString(undefined, {
                  weekday: 'short', month: 'short', day: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                })
              : undefined;
            sendAppEmail({
              templateName: 'booking-confirmation',
              recipientEmail: user.email!,
              idempotencyKey: `booking-confirm-${(data as BookingRow).id}`,
              templateData: {
                studentName: profile?.display_name || undefined,
                courseTitle: (course as any)?.title,
                instructorName: (instructor as any)?.display_name || undefined,
                date: startDate,
                location,
                bookingUrl: `${window.location.origin}/student/booking/${(data as BookingRow).id}`,
                cancelGraceHours: typeof cutoffHours === 'number' ? cutoffHours : undefined,
                cancelDeadline: deadlineStr,
              },
            });
          })();
        }
        return; // stop polling
      }
      if (Date.now() - startedAt.current > MAX_WAIT_MS) {
        setTimedOut(true);
        return;
      }
      timer = window.setTimeout(poll, POLL_MS);
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [id, user, profile?.display_name]);

  const status = booking?.deposit_status;
  const isHeld = status === 'held_in_escrow' || status === 'released';

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="Payment" back={false} />
      <div className="px-4 py-6 space-y-4">
        {error ? (
          <div className="tactical-card p-6 text-center space-y-3 border-destructive/40">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="font-bold">Couldn't load your booking</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => nav('/student/bookings')} variant="outline" className="w-full">
              Back to my bookings
            </Button>
          </div>
        ) : isHeld ? (
          <div className="tactical-card p-6 text-center space-y-3 border-primary/40">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <h2 className="font-bold text-lg">Payment received</h2>
            <p className="text-sm text-muted-foreground">
              Your deposit is <strong className="text-foreground">held in escrow</strong>.
            </p>
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground text-left flex gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                If your instructor cancels or no-shows, you'll receive a <strong className="text-foreground">100% refund ($25 + full course price)</strong> within 48 hours.
              </span>
            </div>
            <Button
              onClick={() => nav(`/student/booking/${id}`)}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              View booking <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        ) : timedOut ? (
          <div className="tactical-card p-6 text-center space-y-3 border-amber-500/40">
            <Clock className="h-10 w-10 text-amber-500 mx-auto" />
            <h2 className="font-bold">Still confirming your payment…</h2>
            <p className="text-sm text-muted-foreground">
              Your payment was submitted but the confirmation hasn't reached us yet. This usually
              clears within a minute. Your booking will update automatically.
            </p>
            <p className="text-[11px] text-muted-foreground">
              Current status: <span className="font-mono">{status ?? 'unknown'}</span>
            </p>
            <Button
              onClick={() => nav(`/student/booking/${id}`)}
              variant="outline"
              className="w-full"
            >
              Check booking now
            </Button>
          </div>
        ) : (
          <div className="tactical-card p-6 text-center space-y-3">
            <Loader2 className="h-10 w-10 text-primary mx-auto animate-spin" />
            <h2 className="font-bold">Confirming your payment…</h2>
            <p className="text-sm text-muted-foreground">
              Our payment processor is finalizing the charge and moving your deposit into escrow.
              Don't close this page.
            </p>
            <p className="text-[11px] text-muted-foreground">
              Status: <span className="font-mono">{status ?? 'loading'}</span>
            </p>
          </div>
        )}

        <div className="text-center">
          <Link to="/student/bookings" className="text-xs text-muted-foreground underline">
            Back to my bookings
          </Link>
        </div>
      </div>
    </MobileShell>
  );
};

export default CheckoutReturn;
