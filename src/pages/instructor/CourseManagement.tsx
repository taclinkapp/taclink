import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { mockRoster, mockWaitlist } from '@/lib/mockData';
import { useCourse } from '@/hooks/useCourses';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Check, X, Bell, QrCode, AlertTriangle, Receipt, ChevronDown, Copy, Lock, Camera, Sparkles, MapPin, Loader2 } from 'lucide-react';
import { computeListingFeeCents, fmt, INSTRUCTOR_LISTING_FEE_PCT } from '@/lib/fees';
import { toast } from 'sonner';
import { QrScanner } from '@/components/QrScanner';
import { parseCheckinPayload, looksLikeSignedToken, PROXIMITY_TRIGGER_METERS } from '@/lib/qrCheckin';
import { useProximity } from '@/hooks/useProximity';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import CancelCourseDialog from '@/components/instructor/CancelCourseDialog';

const tabs = ['Roster', 'Waitlist', 'Check-In'] as const;

const CourseManagement = () => {
  const { id } = useParams();
  const { profile } = useAuth();
  const isSubscribed = profile?.subscription_status === 'active';
  const { data: course, isLoading } = useCourse(id);
  const [tab, setTab] = useState<typeof tabs[number]>('Roster');
  const [showReceipt, setShowReceipt] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [autoCheckin, setAutoCheckin] = useState(false);
  // Two-factor auto check-in: a scanned QR stages a pending booking that
  // proximity must then confirm in-range before the row is marked attended.
  const [pending, setPending] = useState<{ bookingId: string; scannedAt: number } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const PENDING_TTL_MS = 60_000;
  const qc = useQueryClient();

  // Real bookings on this course (used for check-in list + auto check-in pool)
  const { data: bookings = [] } = useQuery({
    queryKey: ['course_bookings', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, status, student_id, attended_at')
        .eq('course_id', id as string);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const markAttended = async (bookingId: string, opts?: { source: 'qr' | 'proximity' }) => {
    const existing = bookings.find((b: any) => b.id === bookingId);
    if (!existing) {
      toast.error('That QR is not for this course.');
      return;
    }
    if (existing.status === 'attended') {
      toast.info('Already checked in.');
      return;
    }
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'attended', attended_at: new Date().toISOString() })
      .eq('id', bookingId);
    if (error) {
      toast.error(error.message);
      return;
    }
    const label =
      opts?.source === 'proximity'
        ? 'Auto check-in confirmed (QR + proximity)'
        : 'Checked in';
    toast.success(label);
    qc.invalidateQueries({ queryKey: ['course_bookings', id] });
  };


  const { data: listingCharge } = useQuery({
    queryKey: ['instructor_charge', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructor_charges')
        .select('*')
        .eq('course_id', id as string)
        .eq('charge_type', 'listing_fee')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // AI proximity engine — watches GPS, smooths noise, fires once near the venue.
  const target = course?.lat && course?.lng ? { lat: course.lat, lng: course.lng } : null;
  const proximity = useProximity({
    target,
    triggerMeters: PROXIMITY_TRIGGER_METERS,
    enabled: autoCheckin,
    onTrigger: () => {
      // Two-factor: only commit the booking that was scanned, and only if
      // the scan is still fresh and the booking belongs to this course.
      if (!pending) {
        toast.info('In range — scan a student QR to confirm check-in.');
        return;
      }
      if (Date.now() - pending.scannedAt > PENDING_TTL_MS) {
        toast.error('Scan expired. Re-scan the student QR.');
        setPending(null);
        return;
      }
      const match = bookings.find((b: any) => b.id === pending.bookingId);
      if (!match) {
        toast.error('Scanned QR is not for this course.');
        setPending(null);
        return;
      }
      if (match.status === 'attended') {
        toast.info('That student is already checked in.');
        setPending(null);
        return;
      }
      markAttended(pending.bookingId, { source: 'proximity' });
      setPending(null);
    },
  });

  useEffect(() => {
    if (autoCheckin && target) proximity.start();
    else proximity.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheckin, target?.lat, target?.lng]);


  if (isLoading || !course) {
    return (
      <MobileShell withTabBar={false}>
        <PageHeader title="Course" back />
        <div className="px-4 py-12 text-center text-muted-foreground text-sm">
          {isLoading ? 'Loading…' : 'Course not found.'}
        </div>
      </MobileShell>
    );
  }

  const c = course;
  const enrolled = c.maxStudents - c.spotsRemaining;
  const attendedBookings = bookings.filter((b: any) => b.status === 'attended');
  const checkedIn = attendedBookings.length;

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title={c.title} back />
      <div className="px-4 pt-3">
        {/* Non-refundable listing fee disclosure + receipt */}
        {(() => {
          const feeCents = listingCharge?.amount_cents ?? computeListingFeeCents(Math.round((c.bookingFee ?? 0) * 100));
          const priceCents = listingCharge?.course_price_cents ?? Math.round((c.bookingFee ?? 0) * 100);
          const ref = listingCharge?.id ? `LF-${listingCharge.id.slice(0, 8).toUpperCase()}` : null;
          const chargedAt = listingCharge?.created_at ? new Date(listingCharge.created_at) : null;
          const copyRef = () => {
            if (!ref) return;
            navigator.clipboard.writeText(ref).then(() => toast.success('Reference copied'));
          };
          return (
            <div className="tactical-card border-primary/40 bg-primary/10 p-3 mb-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] uppercase tracking-wider font-bold">Listing Fee Paid</div>
                    <div className="text-sm font-black text-primary">{fmt(feeCents)}</div>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                    {Math.round(INSTRUCTOR_LISTING_FEE_PCT * 100)}% of course price was charged when this course was published.{' '}
                    <strong className="text-destructive">Non-refundable</strong> — not returned for cancellations, edits, unpublish, or zero bookings.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowReceipt((v) => !v)}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-primary hover:underline"
                  >
                    <Receipt className="h-3 w-3" />
                    {showReceipt ? 'Hide receipt' : 'View receipt'}
                    <ChevronDown className={cn('h-3 w-3 transition-transform', showReceipt && 'rotate-180')} />
                  </button>
                  {showReceipt && (
                    <div className="mt-2 rounded-sm border border-primary/30 bg-background/60 p-2.5 text-[11px] space-y-1.5">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Reference</span>
                        {ref ? (
                          <button onClick={copyRef} className="font-mono text-foreground inline-flex items-center gap-1 hover:text-primary">
                            {ref} <Copy className="h-3 w-3" />
                          </button>
                        ) : (
                          <span className="text-muted-foreground italic">unavailable</span>
                        )}
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Charged on</span>
                        <span className="text-foreground">
                          {chargedAt ? chargedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Course price</span>
                        <span className="text-foreground">{fmt(priceCents)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Rate</span>
                        <span className="text-foreground">{Math.round(INSTRUCTOR_LISTING_FEE_PCT * 100)}%</span>
                      </div>
                      <div className="flex justify-between gap-2 border-t border-primary/20 pt-1.5">
                        <span className="font-bold uppercase tracking-wider text-[10px]">Total charged</span>
                        <span className="font-black text-primary">{fmt(feeCents)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Status</span>
                        <span className="text-success font-semibold uppercase tracking-wider text-[10px]">
                          {listingCharge?.status ?? 'charged'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Refundable</span>
                        <span className="text-destructive font-semibold uppercase tracking-wider text-[10px]">No</span>
                      </div>
                      {listingCharge?.note && (
                        <div className="text-[10px] text-muted-foreground italic pt-1 border-t border-primary/20">
                          {listingCharge.note}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Final-step instructor cancellation */}
        {(c.status as string) !== 'cancelled' && (
          <div className="tactical-card border-destructive/40 bg-destructive/5 p-3 mb-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wider font-bold text-destructive">
                  Cancel this course
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                  Cancel <strong>48+ hours</strong> before start to get your deposit back.
                  Cancelling later refunds students in full and <strong>forfeits your deposit</strong>.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-2 h-8 text-[11px]"
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel course…
                </Button>
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Enrolled', value: enrolled },
            { label: 'Waitlist', value: mockWaitlist.length },
            { label: 'Checked In', value: checkedIn },
          ].map((s) => (
            <div key={s.label} className="tactical-card p-3 text-center">
              <div className="text-xl font-black text-primary">{s.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="flex bg-card border border-border rounded-sm p-0.5">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn('flex-1 h-9 text-xs font-bold uppercase tracking-wider rounded-sm', tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{t}</button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-2">
        {(tab === 'Roster' || tab === 'Check-In') && !isSubscribed ? (
          <div className="tactical-card border-primary/40 bg-primary/5 p-6 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="text-sm font-bold">{tab} is a Pro feature</div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed max-w-xs mx-auto">
                Manage your students, track attendance, and run check-ins with the Pro subscription.
              </p>
            </div>
            <Link
              to="/instructor/subscription"
              className="inline-block text-[11px] font-bold uppercase tracking-wider text-primary hover:underline"
            >
              Upgrade to Pro →
            </Link>
          </div>
        ) : (
          <>
            {tab === 'Roster' && mockRoster.map((s) => (
              <div key={s.id} className="tactical-card p-3 flex items-center gap-3">
                <img src={s.photo} className="h-10 w-10 rounded-full border border-border" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{s.name}</div>
                  <div className="text-[10px] uppercase tracking-wider mt-0.5">
                    <span className={s.paymentStatus === 'paid' ? 'text-success' : 'text-primary'}>{s.paymentStatus}</span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button className={cn('h-9 w-9 rounded-md flex items-center justify-center border', s.checkedIn ? 'bg-success/15 border-success/30 text-success' : 'bg-card border-border text-muted-foreground hover:border-primary hover:text-primary')}>
                    <Check className="h-4 w-4" />
                  </button>
                  <button className="h-9 w-9 rounded-md bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            {tab === 'Waitlist' && (
              <>
                <button className="w-full h-11 rounded-md bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 mb-2">
                  <Bell className="h-4 w-4" /> Notify Waitlist
                </button>
                {mockWaitlist.map((w) => (
                  <div key={w.id} className="tactical-card p-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-black text-sm">#{w.position}</div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{w.name}</div>
                      <div className="text-[10px] text-muted-foreground">Joined {w.joinedAt}</div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {tab === 'Check-In' && (
              <div className="space-y-3">
                {/* Scan QR */}
                <div className="tactical-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center">
                      <QrCode className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold">Scan student QR</div>
                      <div className="text-[11px] text-muted-foreground">Each student shows their booking QR.</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setScannerOpen(true)}
                    className="mt-3 w-full h-11 rounded-md bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2"
                  >
                    <Camera className="h-4 w-4" /> Open Scanner
                  </button>
                </div>

                {/* AI auto check-in */}
                <div className="tactical-card p-4 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-primary/20 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold flex items-center gap-2">
                        AI Auto Check-In
                        <span className="text-[9px] uppercase tracking-wider bg-primary/20 text-primary px-1.5 py-0.5 rounded">Beta</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Triggers within ~10 ft of the venue. Uses smoothed GPS + accuracy filter.
                      </div>
                    </div>
                    <Switch
                      checked={autoCheckin}
                      disabled={!target}
                      onCheckedChange={(v) => {
                        if (!target) {
                          toast.error('This course has no venue coordinates set.');
                          return;
                        }
                        setAutoCheckin(v);
                      }}
                    />
                  </div>
                  {autoCheckin && (
                    <div className="mt-3 rounded-md bg-card border border-border p-3 text-[11px] text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        {proximity.error ? (
                          <span className="text-destructive">{proximity.error}</span>
                        ) : !proximity.reading ? (
                          <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Locking GPS…</span>
                        ) : (
                          <span>
                            Distance: <span className="text-foreground font-bold">{proximity.reading.smoothedM.toFixed(1)} m</span>
                            {' · '}±{proximity.reading.accuracyM.toFixed(0)} m
                          </span>
                        )}
                      </div>
                      <div>Trigger at ≤ {PROXIMITY_TRIGGER_METERS} m (~10 ft) — only after a QR scan.</div>
                    </div>
                  )}

                  {pending && (
                    <div className="mt-3 rounded-md border border-primary/40 bg-primary/10 p-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
                        <QrCode className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 text-[11px]">
                        <div className="font-bold text-foreground">
                          Pending: Booking {pending.bookingId.slice(0, 8).toUpperCase()}
                        </div>
                        <div className="text-muted-foreground">
                          Waiting for proximity to confirm (expires in{' '}
                          {Math.max(0, Math.ceil((PENDING_TTL_MS - (Date.now() - pending.scannedAt)) / 1000))}s).
                        </div>
                      </div>
                      <button
                        onClick={() => setPending(null)}
                        className="text-[10px] uppercase tracking-wider font-bold text-destructive hover:underline shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Live check-ins (real bookings) */}
                <div>
                  <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold mb-2 mt-4">
                    Checked In ({attendedBookings.length}/{bookings.length})
                  </h3>
                  {attendedBookings.length === 0 ? (
                    <div className="tactical-card p-4 text-center text-xs text-muted-foreground">
                      No check-ins yet. Scan a QR or enable auto check-in.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attendedBookings.map((b: any) => (
                        <div key={b.id} className="tactical-card p-3 flex items-center gap-3 border-success/20 bg-success/5">
                          <div className="h-9 w-9 rounded-full bg-success/15 border border-success/30 flex items-center justify-center">
                            <Check className="h-4 w-4 text-success" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">Booking {b.id.slice(0, 8).toUpperCase()}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {b.attended_at ? new Date(b.attended_at).toLocaleTimeString() : 'just now'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {scannerOpen && (
        <QrScanner
          onDecode={async (text) => {
            setScannerOpen(false);

            // Resolve the booking ID — signed tokens go through server verification,
            // legacy v1 tokens are still parsed but with a warning.
            let resolvedBookingId: string | null = null;

            if (looksLikeSignedToken(text)) {
              try {
                const { data, error } = await supabase.functions.invoke('verify-checkin-qr', {
                  body: { token: text, courseId: id },
                });
                if (error) throw error;
                if (!data?.ok) {
                  toast.error(data?.reason ?? 'QR verification failed.');
                  return;
                }
                resolvedBookingId = data.bookingId;
              } catch (e: any) {
                toast.error(e?.message ?? 'Could not verify QR.');
                return;
              }
            } else {
              const parsed = parseCheckinPayload(text);
              if (!parsed) {
                toast.error('Not a valid TacLink check-in QR.');
                return;
              }
              toast.warning('Unsigned QR detected — ask the student to refresh their booking page.');
              resolvedBookingId = parsed.bookingId;
            }

            if (!resolvedBookingId) return;
            const match = bookings.find((b: any) => b.id === resolvedBookingId);
            if (!match) {
              toast.error('That QR is not for this course.');
              return;
            }
            if (match.status === 'attended') {
              toast.info('Already checked in.');
              return;
            }
            if (autoCheckin) {
              const inRange =
                proximity.reading && proximity.reading.smoothedM <= PROXIMITY_TRIGGER_METERS;
              if (inRange) {
                markAttended(resolvedBookingId, { source: 'proximity' });
                setPending(null);
              } else {
                setPending({ bookingId: resolvedBookingId, scannedAt: Date.now() });
                toast.info('QR verified — waiting for proximity to confirm.');
              }
            } else {
              markAttended(resolvedBookingId, { source: 'qr' });
            }
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </MobileShell>
  );
};

export default CourseManagement;
