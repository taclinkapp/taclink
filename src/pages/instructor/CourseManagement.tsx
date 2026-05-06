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
import { ScanResultDialog, type ScanOutcome } from '@/components/instructor/ScanResultDialog';
import { usePrelaunch } from '@/hooks/usePrelaunch';

const tabs = ['Roster', 'Waitlist', 'Check-In'] as const;

const CourseManagement = () => {
  const { id } = useParams();
  const { profile } = useAuth();
  const { data: prelaunch } = usePrelaunch();
  const isPrelaunch = !!prelaunch?.enabled;
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
  // Last scan outcome — drives the user-friendly retry dialog.
  const [scanOutcome, setScanOutcome] = useState<ScanOutcome | null>(null);
  const PENDING_TTL_MS = 60_000;
  const qc = useQueryClient();

  // Real bookings on this course (used for check-in list + auto check-in pool)
  const { data: bookings = [] } = useQuery({
    queryKey: ['course_bookings', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, status, student_id, attended_at, profiles:student_id(display_name)')
        .eq('course_id', id as string);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const studentNameFor = (b: any): string | null =>
    b?.profiles?.display_name || null;

  const markAttended = async (
    bookingId: string,
    opts?: { source: 'qr' | 'proximity' },
  ): Promise<ScanOutcome> => {
    const existing = bookings.find((b: any) => b.id === bookingId);
    const studentName = existing ? studentNameFor(existing) : null;
    if (!existing) {
      return { kind: 'wrong_course' };
    }
    if (existing.status === 'attended') {
      return { kind: 'already_attended', bookingId, studentName };
    }
    if (existing.status === 'cancelled' || existing.status === 'no_show') {
      return { kind: 'cannot_checkin', bookingId, status: existing.status };
    }
    // Atomic guard: only flip 'reserved' → 'attended'. If another scan got here
    // first the row will already be 'attended' and the conditional update
    // returns 0 rows, which we surface as 'already_attended' so the instructor
    // sees a clear retry-friendly message instead of an error.
    // Ordering note: attended_at is the column release-escrow-deposits filters on,
    // so attendance MUST commit before any payout eligibility update. The release
    // job also runs on a 24h delay, so there is no race with payout dispatch.
    const { data: updated, error } = await supabase
      .from('bookings')
      .update({ status: 'attended', attended_at: new Date().toISOString() })
      .eq('id', bookingId)
      .eq('status', 'reserved')
      .is('attended_at', null)
      .select('id')
      .maybeSingle();
    if (error) {
      return { kind: 'rpc_error', bookingId, reason: error.message };
    }
    qc.invalidateQueries({ queryKey: ['course_bookings', id] });
    if (!updated) {
      // Lost the race to another scan/admin update — treat as a benign
      // double-scan so the instructor knows the student is still good to go.
      return { kind: 'already_attended', bookingId, studentName };
    }
    return { kind: 'success', bookingId, studentName, source: opts?.source ?? 'qr' };
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
      markAttended(pending.bookingId, { source: 'proximity' }).then((outcome) =>
        setScanOutcome(outcome),
      );
      setPending(null);
    },
  });

  useEffect(() => {
    if (autoCheckin && target) proximity.start();
    else proximity.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheckin, target?.lat, target?.lng]);

  // Telemetry: log every scan outcome to checkin_attempts via the
  // record_checkin_attempt RPC. The server validates instructor ownership
  // of the course, so a tampered client can't poison another instructor's log.
  useEffect(() => {
    if (!scanOutcome || !id) return;
    const o = scanOutcome;
    const bookingId = 'bookingId' in o ? o.bookingId ?? null : null;
    const source: 'qr' | 'proximity' = o.kind === 'success' ? o.source : 'qr';
    const reason =
      o.kind === 'verification_failed' || o.kind === 'invalid_qr' || o.kind === 'rpc_error'
        ? o.reason
        : o.kind === 'cannot_checkin'
          ? `status=${o.status}`
          : null;
    supabase
      .rpc('record_checkin_attempt', {
        _course_id: id,
        _outcome: o.kind,
        _booking_id: bookingId,
        _source: source,
        _reason: reason,
      })
      .then(() => { /* fire-and-forget */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanOutcome, id]);


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
        {/* Drafts haven't been published yet — no listing fee, no penalty, no refunds. */}
        {(c.status as string) === 'draft' && (
          <div className="tactical-card border-border bg-muted/20 p-3 mb-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wider font-bold">Draft course</div>
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                  This course is unpublished — no listing fee has been charged and no students can book.
                  You can delete it any time at no cost.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-2 h-8 text-[11px]"
                  onClick={async () => {
                    if (!confirm('Delete this draft? This cannot be undone.')) return;
                    const { error } = await supabase.from('courses').delete().eq('id', c.id);
                    if (error) {
                      toast.error('Could not delete draft', { description: error.message });
                      return;
                    }
                    toast.success('Draft deleted');
                    qc.invalidateQueries({ queryKey: ['courses'] });
                    window.history.back();
                  }}
                >
                  Delete draft
                </Button>
              </div>
            </div>
          </div>
        )}
        {/* Non-refundable listing fee disclosure + receipt — only for published/active courses */}
        {(c.status as string) !== 'draft' && (() => {
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

        {/* Hide cancel-with-penalty card on drafts (no bookings, no penalty). */}

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
                  Students always get a full refund (platform fee + deposit) when you cancel.
                  Your outcome depends on timing:
                </p>
                <ul className="text-[10px] text-muted-foreground leading-relaxed mt-1 ml-3 list-disc space-y-0.5">
                  <li>
                    <strong className="text-success">48+ hours before start:</strong> your deposit is released back to you. No strike.
                  </li>
                  <li>
                    <strong className="text-destructive">Less than 48 hours before start:</strong> you forfeit your deposit on every booking and receive 1 strike.
                  </li>
                </ul>
                <a href="/legal/cancellations" className="text-[10px] text-primary underline mt-1 inline-block">
                  See full cancellation policy
                </a>
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
            {isPrelaunch ? (
              <p className="text-[11px] text-muted-foreground">
                Available when TacLink launches.
              </p>
            ) : (
              <Link
                to="/instructor/subscription"
                className="inline-block text-[11px] font-bold uppercase tracking-wider text-primary hover:underline"
              >
                Upgrade to Pro →
              </Link>
            )}
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

            // Resolve the booking ID. Signed tokens go through server
            // verification; legacy v1 tokens still resolve but trip the
            // unsigned-warning outcome so the instructor knows to ask for a
            // refreshed QR.
            let resolvedBookingId: string | null = null;
            let unsigned = false;

            if (looksLikeSignedToken(text)) {
              try {
                const { data, error } = await supabase.functions.invoke('verify-checkin-qr', {
                  body: { token: text, courseId: id },
                });
                if (error) throw error;
                if (!data?.ok) {
                  setScanOutcome({
                    kind: 'verification_failed',
                    reason: data?.reason ?? 'QR verification failed',
                  });
                  return;
                }
                resolvedBookingId = data.bookingId;
              } catch (e: any) {
                setScanOutcome({
                  kind: 'verification_failed',
                  reason: e?.message ?? 'Could not reach verification service',
                });
                return;
              }
            } else {
              const parsed = parseCheckinPayload(text);
              if (!parsed) {
                setScanOutcome({
                  kind: 'invalid_qr',
                  reason: 'The scanned code is not a TacLink check-in QR.',
                });
                return;
              }
              unsigned = true;
              resolvedBookingId = parsed.bookingId;
            }

            if (!resolvedBookingId) return;
            const match = bookings.find((b: any) => b.id === resolvedBookingId);
            if (!match) {
              setScanOutcome({ kind: 'wrong_course', bookingId: resolvedBookingId });
              return;
            }
            const studentName = studentNameFor(match);

            // Surface unsigned-QR warning before attempting attendance so the
            // instructor knows to follow up — but still proceed (single-source policy).
            if (unsigned) {
              setScanOutcome({ kind: 'unsigned_warning', bookingId: resolvedBookingId, studentName });
              return;
            }

            if (match.status === 'attended') {
              setScanOutcome({ kind: 'already_attended', bookingId: resolvedBookingId, studentName });
              return;
            }

            if (autoCheckin) {
              const inRange =
                proximity.reading && proximity.reading.smoothedM <= PROXIMITY_TRIGGER_METERS;
              if (inRange) {
                const outcome = await markAttended(resolvedBookingId, { source: 'proximity' });
                setPending(null);
                setScanOutcome(outcome);
              } else {
                setPending({ bookingId: resolvedBookingId, scannedAt: Date.now() });
                setScanOutcome({ kind: 'pending_proximity', bookingId: resolvedBookingId, studentName });
              }
            } else {
              const outcome = await markAttended(resolvedBookingId, { source: 'qr' });
              setScanOutcome(outcome);
            }
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}

      <ScanResultDialog
        outcome={scanOutcome}
        onScanAnother={() => {
          setScanOutcome(null);
          setScannerOpen(true);
        }}
        onClose={() => setScanOutcome(null)}
      />


      <CancelCourseDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        courseId={c.id}
        courseTitle={c.title}
        startsAt={c.date && c.startTime ? `${c.date}T${c.startTime}` : null}
        onCancelled={() => qc.invalidateQueries({ queryKey: ['course', c.id] })}
      />
    </MobileShell>
  );
};

export default CourseManagement;
