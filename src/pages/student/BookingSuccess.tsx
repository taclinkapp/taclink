import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MobileShell } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Calendar, MapPin, Clock, FileText, ShieldCheck, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { CancelGraceBadge } from '@/components/student/CancelGraceBadge';
import { useOnboarding } from '@/hooks/useOnboarding';
import { NotificationPermissionPrompt } from '@/components/onboarding/NotificationPermissionPrompt';
import { QRCodeSVG } from 'qrcode.react';

type Course = {
  id: string;
  title: string;
  address: string | null;
  city: string | null;
  state: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

type Signature = {
  id: string;
  signed_full_name: string;
  waiver_version: number;
  signed_at: string;
};

type BookingLite = {
  id: string;
  booked_at: string | null;
  cancellation_cutoff_hours: number | null;
  deposit_status: string | null;
  status: string;
};

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';

const buildIcs = (course: Course, ref: string) => {
  if (!course.starts_at) return null;
  const start = new Date(course.starts_at);
  const end = course.ends_at ? new Date(course.ends_at) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const toIcs = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const location = [course.address, course.city, course.state].filter(Boolean).join(', ');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TacLink//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${ref}@taclink.app`,
    `DTSTAMP:${toIcs(new Date())}`,
    `DTSTART:${toIcs(start)}`,
    `DTEND:${toIcs(end)}`,
    `SUMMARY:${course.title.replace(/[\n,]/g, ' ')}`,
    location ? `LOCATION:${location.replace(/[\n,]/g, ' ')}` : '',
    `DESCRIPTION:Booking ${ref} — TacLink`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
};

const BookingSuccess = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [booking, setBooking] = useState<BookingLite | null>(null);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [notifPromptOpen, setNotifPromptOpen] = useState(false);
  const [signedToken, setSignedToken] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string | null>(null);
  const [manualCodeAvailableAt, setManualCodeAvailableAt] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const onboarding = useOnboarding();

  const fetchSignedToken = async (bookingId: string) => {
    setTokenLoading(true);
    setTokenError(null);
    try {
      const { data, error } = await supabase.functions.invoke('sign-checkin-qr', { body: { bookingId } });
      if (error) throw error;
      if (!data?.token) throw new Error('No token returned');
      setSignedToken(data.token);
      setManualCode(data.manualCode ?? null);
      setManualCodeAvailableAt(data.manualCodeAvailableAt ?? null);
    } catch (e: any) {
      setTokenError(e?.message ?? 'Could not load secure QR');
      setSignedToken(null);
      setManualCode(null);
    } finally {
      setTokenLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      const { data: c } = await supabase
        .from('courses')
        .select('id, title, address, city, state, starts_at, ends_at')
        .eq('id', id)
        .maybeSingle();

      if (!user || !c) {
        if (!cancelled) {
          setCourse((c as Course) ?? null);
          setNotFound(!c);
          setLoading(false);
        }
        return;
      }
      const { data: b } = await supabase
        .from('bookings')
        .select('id, booked_at, cancellation_cutoff_hours, deposit_status, status')
        .eq('student_id', user.id)
        .eq('course_id', c.id)
        .order('booked_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (!b) {
        setCourse(c as Course);
        setNotFound(true);
        setLoading(false);
        return;
      }
      setCourse(c as Course);
      setBooking(b as BookingLite);

      const { data: s } = await supabase
        .from('waiver_signatures')
        .select('id, signed_full_name, waiver_version, signed_at')
        .eq('booking_id', b.id)
        .maybeSingle();
      setSignature((s as Signature) ?? null);

      // Only mint a signed QR when the deposit is actually settled.
      if (b.deposit_status === 'held_in_escrow' || b.deposit_status === 'confirmed' || b.deposit_status === 'released') {
        fetchSignedToken(b.id);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, user]);

  // First-booking onboarding only fires once we know the booking actually exists.
  useEffect(() => {
    if (!user || !booking || onboarding.loading) return;
    if (!onboarding.checklist.first_booking) {
      onboarding.checkOff('first_booking');
    }
    if (!onboarding.notifPromptShown) {
      setNotifPromptOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, booking?.id, onboarding.loading]);

  if (loading) {
    return (
      <MobileShell withTabBar={false}>
        <div className="px-6 py-16 text-center text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading…
        </div>
      </MobileShell>
    );
  }

  if (notFound || !booking || !course) {
    return (
      <MobileShell withTabBar={false}>
        <div className="px-6 py-16 text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
          <h2 className="text-lg font-bold">No booking to show</h2>
          <p className="text-sm text-muted-foreground">
            We couldn't find a booking for you on this course.
          </p>
          <Button onClick={() => nav('/student/bookings')} className="w-full h-11 bg-primary text-primary-foreground font-bold">
            View My Bookings
          </Button>
        </div>
      </MobileShell>
    );
  }

  const ref = `TL-${booking.id.slice(0, 8).toUpperCase()}`;
  const qrSettled = booking.deposit_status === 'held_in_escrow' || booking.deposit_status === 'confirmed' || booking.deposit_status === 'released';

  const downloadIcs = () => {
    const ics = buildIcs(course, ref);
    if (!ics) return;
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ref}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <MobileShell withTabBar={false}>
      <div className="px-6 py-12 text-center">
        <div className="h-24 w-24 rounded-full bg-success/15 border-2 border-success/40 flex items-center justify-center mx-auto mb-6 amber-glow" style={{ boxShadow: '0 8px 24px -8px hsl(142 71% 45% / 0.5)' }}>
          <CheckCircle2 className="h-12 w-12 text-success" strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl font-black mb-2">You're Booked!</h1>
        <p className="text-muted-foreground text-sm mb-8">Confirmation sent to your email.</p>

        <div className="tactical-card p-5 text-left mb-6">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Booking Reference</div>
          <div className="font-mono text-primary font-bold mb-4">{ref}</div>
          <h2 className="font-bold mb-3">{course.title}</h2>
          <div className="space-y-2 text-xs text-muted-foreground">
            {course.starts_at && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                {new Date(course.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
            )}
            {course.starts_at && (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-primary" />
                {fmtTime(course.starts_at)}{course.ends_at ? ` – ${fmtTime(course.ends_at)}` : ''}
              </div>
            )}
            {(course.address || course.city || course.state) && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {[course.address, course.city, course.state].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        </div>

        <div className="text-left mb-6">
          <CancelGraceBadge
            startsAt={course.starts_at}
            bookedAt={booking.booked_at}
            cutoffHours={booking.cancellation_cutoff_hours}
            variant="card"
          />
        </div>

        {signature && (
          <div className="tactical-card p-5 text-left mb-6 border-primary/40">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-primary" />
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Waiver Signature Receipt</div>
              <span className="ml-auto text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30">v{signature.waiver_version}</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Signed by</span>
                <span className="font-serif italic text-foreground text-sm">{signature.signed_full_name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Timestamp</span>
                <span className="font-mono text-foreground">{new Date(signature.signed_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Receipt ID</span>
                <span className="font-mono text-foreground">{signature.id.slice(0, 8).toUpperCase()}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-[10px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-primary" />
              Stored securely with a snapshot of the waiver content.
            </div>
          </div>
        )}

        {/* Real signed check-in QR */}
        <div className="tactical-card p-5 mb-6">
          <div className="flex items-center justify-center gap-1.5 mb-3">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Signed Check-In QR</div>
          </div>
          <div className="mx-auto bg-white p-3 rounded-sm w-fit">
            {!qrSettled ? (
              <div className="h-[176px] w-[176px] flex items-center justify-center text-xs text-muted-foreground p-4 text-center">
                Your QR unlocks once payment is confirmed.
              </div>
            ) : tokenLoading && !signedToken ? (
              <div className="h-[176px] w-[176px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : signedToken ? (
              <QRCodeSVG value={signedToken} size={176} level="M" includeMargin={false} />
            ) : (
              <div className="h-[176px] w-[176px] flex flex-col items-center justify-center text-xs text-destructive p-4 text-center">
                <AlertTriangle className="h-5 w-5 mb-2" />
                {tokenError ?? 'Could not load secure QR'}
              </div>
            )}
          </div>
          {qrSettled && (
            <button
              type="button"
              onClick={() => fetchSignedToken(booking.id)}
              disabled={tokenLoading}
              className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-primary hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${tokenLoading ? 'animate-spin' : ''}`} />
              {tokenLoading ? 'Refreshing' : 'Refresh QR'}
            </button>
          )}
          {qrSettled && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
                Backup check-in code
              </div>
              {manualCode ? (
                <>
                  <div className="font-mono text-3xl font-black tracking-[0.35em] text-primary tabular-nums">
                    {manualCode.slice(0, 3)} {manualCode.slice(3)}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                    If the QR won't scan, read this 6-digit code to your instructor.
                  </p>
                </>
              ) : (
                <>
                  <div className="font-mono text-2xl font-black tracking-[0.3em] text-muted-foreground/40 tabular-nums">
                    — — — — — —
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                    Activates {manualCodeAvailableAt
                      ? `at ${new Date(manualCodeAvailableAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : '30 minutes before your course starts'}.
                  </p>
                </>
              )}
            </div>
          )}
          <div className="text-[10px] text-muted-foreground mt-2">Show this on the day of training</div>
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={downloadIcs}
            disabled={!course.starts_at}
            className="w-full h-11 bg-card border-border font-semibold"
          >
            Add to Calendar
          </Button>
          <Button onClick={() => nav('/student/bookings')} className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">View My Bookings</Button>
        </div>
      </div>
      {notifPromptOpen && (
        <NotificationPermissionPrompt onClose={() => setNotifPromptOpen(false)} />
      )}
    </MobileShell>
  );
};

export default BookingSuccess;
