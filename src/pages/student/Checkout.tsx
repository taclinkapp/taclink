import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, FileText, Loader2, ShieldCheck, Lock, CalendarX, BookmarkCheck } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { computeFees, fmt } from '@/lib/fees';
import { HowPaymentsWorkCard } from '@/components/HowPaymentsWorkCard';
import { sendAppEmail } from '@/lib/appEmail';
import { cancelDeadline } from '@/lib/cancellation';
import { HelcimEscrowCheckout } from '@/components/student/HelcimEscrowCheckout';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';
import { PaymentStatusBanner } from '@/components/student/PaymentStatusBanner';


type Course = {
  id: string;
  title: string;
  instructor_id: string;
  city: string | null;
  state: string | null;
  starts_at: string | null;
  price_cents: number;
  in_person_waiver: boolean | null;
};

type Waiver = {
  id: string;
  course_id: string;
  title: string;
  content: string;
  version: number;
  published: boolean;
};

const Checkout = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, profile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [waiver, setWaiver] = useState<Waiver | null>(null);

  const [agreeRisk, setAgreeRisk] = useState(false);
  const [agreeWaiver, setAgreeWaiver] = useState(false);
  const [signedName, setSignedName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ESIGN / UETA explicit electronic-sign intent
  const ESIGN_DISCLOSURE_VERSION = 'v1.0';
  const [esignConsent, setEsignConsent] = useState(false);
  const [esignInitials, setEsignInitials] = useState('');

  // Minor / parent-or-guardian flow
  const [isMinor, setIsMinor] = useState(false);
  const [studentDob, setStudentDob] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('');
  const [guardianConsent, setGuardianConsent] = useState(false);

  // Created booking + Embedded Checkout takeover
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [skipAutoResume, setSkipAutoResume] = useState(false);

  // Inline conflict surfaced from server-side double-booking guards
  const [conflict, setConflict] = useState<
    | { kind: 'already_booked'; existingBookingId?: string | null }
    | { kind: 'time_overlap'; conflictTitle?: string }
    | null
  >(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: c, error: cErr } = await supabase
        .from('courses')
        .select('id, title, instructor_id, city, state, starts_at, price_cents, in_person_waiver')
        .eq('id', id)
        .maybeSingle();
      if (cErr) toast.error(cErr.message);

      let w: Waiver | null = null;
      if (c) {
        const { data: wRow } = await supabase
          .from('course_waivers')
          .select('id, course_id, title, content, version, published')
          .eq('course_id', c.id)
          .eq('published', true)
          .maybeSingle();
        w = (wRow as Waiver) ?? null;
      }

      // NOTE: do NOT auto-jump to Secure Payment here even if a booking row
      // already exists. Reserve Spot / Book Now must always land on the
      // Confirm Booking page first; the user advances explicitly via
      // "Continue to Secure Payment".

      if (cancelled) return;
      setCourse((c as Course) ?? null);
      setWaiver(w);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  useEffect(() => {
    if (profile?.display_name && !signedName) setSignedName(profile.display_name);
  }, [profile?.display_name]); // eslint-disable-line react-hooks/exhaustive-deps

  const fees = useMemo(() => computeFees(course?.price_cents ?? 0), [course]);

  const minorReady = !isMinor || (
    !!studentDob &&
    guardianName.trim().length >= 3 &&
    guardianRelationship.trim().length >= 2 &&
    guardianConsent
  );
  const esignReady = !waiver || (
    esignConsent &&
    esignInitials.trim().length >= 2
  );
  const waiverReady = !waiver || (agreeWaiver && signedName.trim().length >= 3 && esignReady && minorReady);
  const canSubmit = !!user && !!course && agreeRisk && waiverReady && !submitting;

  const findExistingBooking = async () => {
    if (!user || !course) return null;
    const { data, error } = await supabase
      .from('bookings')
      .select('id, booked_at, cancellation_cutoff_hours, deposit_status')
      .eq('student_id', user.id)
      .eq('course_id', course.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const handleConfirm = async () => {
    if (!user) { toast.error('Please sign in to book'); return; }
    if (!course) return;
    if (waiver && !waiverReady) {
      toast.error('Sign the waiver above before continuing to payment.');
      return;
    }
    setSubmitting(true);
    setConflict(null);
    try {
      const existingBooking = await findExistingBooking();
      if (existingBooking) {
        // Active booking already exists for this course — surface inline,
        // but still allow continuing into payment if it's pending.
        if ((existingBooking as any).deposit_status === 'pending_payment') {
          setBookingId(existingBooking.id);
          return;
        }
        setConflict({ kind: 'already_booked', existingBookingId: existingBooking.id });
        return;
      }

      // Create the booking record up-front in pending_payment state.
      // The payment webhook flips it to held_in_escrow once payment lands.
      const { data: booking, error: bErr } = await supabase
        .from('bookings')
        .insert({
          student_id: user.id,
          course_id: course.id,
          status: 'reserved',
          course_price_cents: fees.coursePriceCents,
          platform_fee_cents: fees.platformFeeCents,
          instructor_deposit_cents: fees.instructorDepositCents,
          due_in_person_cents: fees.dueInPersonCents,
          online_total_cents: fees.onlineTotalCents,
          deposit_status: 'pending_payment',
          deposit_amount_cents: fees.instructorDepositCents,
        })
        .select('id, booked_at, cancellation_cutoff_hours')
        .single();
      if (bErr) {
        if (bErr.code === '23505' || /bookings_active_student_course_uidx|bookings_student_id_course_id_key/i.test(bErr.message ?? '')) {
          const retryBooking = await findExistingBooking();
          setConflict({ kind: 'already_booked', existingBookingId: retryBooking?.id ?? null });
          return;
        }
        if (/overlaps this time slot/i.test(bErr.message ?? '')) {
          const m = bErr.message.match(/conflicts with: ([^)]+)\)/i);
          setConflict({ kind: 'time_overlap', conflictTitle: m?.[1]?.trim() });
          return;
        }
        throw bErr;
      }

      await supabase.from('booking_fees').insert({
        booking_id: booking.id,
        course_id: course.id,
        student_id: user.id,
        instructor_id: course.instructor_id,
        course_price_cents: fees.coursePriceCents,
        platform_fee_cents: fees.platformFeeCents,
        instructor_deposit_cents: fees.instructorDepositCents,
        due_in_person_cents: fees.dueInPersonCents,
        online_total_cents: fees.onlineTotalCents,
      });

      if (waiver) {
        const { error: sErr } = await supabase.from('waiver_signatures').insert({
          booking_id: booking.id,
          course_id: course.id,
          student_id: user.id,
          waiver_id: waiver.id,
          waiver_version: waiver.version,
          waiver_content_snapshot: waiver.content,
          signed_full_name: signedName.trim(),
          user_agent: navigator.userAgent,
          esign_consent_acknowledged: esignConsent,
          esign_disclosure_version: ESIGN_DISCLOSURE_VERSION,
          esign_consent_initials: esignInitials.trim().toUpperCase(),
          is_minor: isMinor,
          student_date_of_birth: isMinor && studentDob ? studentDob : null,
          guardian_full_name: isMinor ? guardianName.trim() : null,
          guardian_relationship: isMinor ? guardianRelationship.trim() : null,
          guardian_signed_at: isMinor ? new Date().toISOString() : null,
        });
        if (sErr) {
          await supabase.from('bookings').delete().eq('id', booking.id);
          throw sErr;
        }
      }

      // Best-effort confirmation email after payment lands.
      if (user.email) {
        const { data: instructor } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', course.instructor_id)
          .maybeSingle();
        const startDate = course.starts_at
          ? new Date(course.starts_at).toLocaleString(undefined, {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              hour: 'numeric', minute: '2-digit',
            })
          : undefined;
        const location = [course.city, course.state].filter(Boolean).join(', ') || undefined;
        const cutoffHours = (booking as any)?.cancellation_cutoff_hours ?? null;
        const bookedAt = (booking as any)?.booked_at ?? null;
        const deadline = cancelDeadline(course.starts_at ?? null, bookedAt, cutoffHours);
        const deadlineStr = deadline
          ? deadline.toLocaleString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric',
              hour: 'numeric', minute: '2-digit',
            })
          : undefined;
        sendAppEmail({
          templateName: 'booking-confirmation',
          recipientEmail: user.email,
          idempotencyKey: `booking-confirm-${booking.id}`,
          templateData: {
            studentName: profile?.display_name || undefined,
            courseTitle: course.title,
            instructorName: (instructor as any)?.display_name || undefined,
            date: startDate,
            location,
            bookingUrl: `${window.location.origin}/student/booking/${booking.id}`,
            cancelGraceHours: typeof cutoffHours === 'number' ? cutoffHours : undefined,
            cancelDeadline: deadlineStr,
          },
        });
      }

      // Hand off to Embedded Checkout.
      setBookingId(booking.id);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not start checkout');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <MobileShell withTabBar={false}>
        <PageHeader title="Confirm Booking" back backTo={`/student/course/${id}`} />
        <div className="px-4 py-12 text-center text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading…
        </div>
      </MobileShell>
    );
  }

  if (!course) {
    return (
      <MobileShell withTabBar={false}>
        <PageHeader title="Confirm Booking" back backTo={`/student/course/${id}`} />
        <div className="px-4 py-12 text-center text-muted-foreground text-sm">Course not found.</div>
      </MobileShell>
    );
  }

  // Embedded Checkout takeover after the booking is created.
  if (bookingId) {
    const returnUrl = `${window.location.origin}/student/checkout/${bookingId}/return`;
    return (
      <MobileShell withTabBar={false}>
        <PaymentTestModeBanner />
        <PageHeader title="Secure Payment" back onBack={() => { setSkipAutoResume(true); setBookingId(null); }} />
        <div className="px-4 py-4 space-y-3">
          <PaymentStatusBanner bookingId={bookingId} />
          
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-primary" /> Charged securely by our PCI-compliant payment processor — your card never touches our servers.
          </div>
          <HelcimEscrowCheckout bookingId={bookingId} returnUrl={returnUrl} />
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell withTabBar={false}>
      <PaymentTestModeBanner />
      <PageHeader title="Confirm Booking" back backTo={`/student/course/${id}`} />
      <div className="px-4 py-4 space-y-4">
        <div className="tactical-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Course</div>
          <h2 className="font-bold">{course.title}</h2>
          <div className="text-xs text-muted-foreground mt-1">
            {course.starts_at ? new Date(course.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBD'}
            {course.city ? ` · ${course.city}` : ''}{course.state ? `, ${course.state}` : ''}
          </div>
        </div>

        <HowPaymentsWorkCard audience="student" />

        <div className="tactical-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Price Breakdown</div>
          <div className="space-y-2 text-sm">
            <Row label="Course price" value={fmt(fees.coursePriceCents)} muted />
            <Row label="TacLink platform fee" value={fmt(fees.platformFeeCents)} />
            <div className="border-t border-border pt-2 mt-2 flex justify-between">
              <span className="font-bold">Total charged today</span>
              <span className="font-black text-primary text-lg">{fmt(fees.onlineTotalCents)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-dashed border-border mt-2 text-success">
              <span className="font-semibold">Nothing due in person ✓</span>
              <span className="font-bold">$0.00</span>
            </div>
          </div>
          <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-[11px] text-muted-foreground leading-relaxed">
            TacLink charges <strong className="text-foreground">{fmt(fees.onlineTotalCents)}</strong> today via secure card processing. The full course price is held in secure escrow and released to your instructor 24 hours after they scan you in at the course (a flat <strong className="text-foreground">{(0.029 * 100).toFixed(1)}%</strong> payout-processor transfer fee is deducted from the instructor's payout, not from your total). If they cancel or no-show, you're refunded in full within 48 hours. <strong className="text-foreground">No cash, no card readers — payment is fully handled by the app.</strong>
          </div>
        </div>

        {/* Risk acknowledgement */}
        <div className="tactical-card p-4 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              Cancel within your grace window for a <strong className="text-foreground">100% refund ($25 platform fee + full course price)</strong>. After the grace window, you receive <strong className="text-foreground">90% of the course price</strong> back — instructor keeps 10% for the lost slot, $25 platform fee non-refundable. If the instructor cancels or no-shows: <strong className="text-foreground">100% refund within 48 hours</strong>.
            </div>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox checked={agreeRisk} onCheckedChange={(v) => setAgreeRisk(!!v)} className="mt-0.5" />
            <span className="text-xs text-muted-foreground leading-relaxed">
              I understand this training involves inherent risks including risk of injury or death.
            </span>
          </label>
        </div>

        {waiver ? (
          <div className="tactical-card p-4 border-primary/40">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-primary" />
              <div className="text-xs uppercase tracking-wider font-bold">{waiver.title}</div>
              <span className="ml-auto text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30">v{waiver.version}</span>
            </div>
            <div className="prose prose-sm max-w-none text-xs max-h-56 overflow-y-auto border border-border rounded-md p-3 bg-background mb-3">
              <ReactMarkdown>{waiver.content}</ReactMarkdown>
            </div>

            <label className="flex items-start gap-3 cursor-pointer mb-3">
              <Checkbox checked={agreeWaiver} onCheckedChange={(v) => setAgreeWaiver(!!v)} className="mt-0.5" />
              <span className="text-xs text-muted-foreground leading-relaxed">
                I have read, understood, and agree to be bound by this waiver. Booking is blocked until I e-sign below.
              </span>
            </label>

            <div>
              <Label className="text-xs text-muted-foreground">Type your full legal name to sign</Label>
              <Input
                value={signedName}
                onChange={(e) => setSignedName(e.target.value)}
                placeholder="Your full legal name"
                className="bg-background border-border h-11 mt-1 font-serif italic text-base"
              />
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Your signature is recorded with a timestamped snapshot of this waiver.
              </p>
            </div>

            {/* ESIGN / UETA explicit consent */}
            <div className="mt-4 rounded-md border border-border bg-background p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                Electronic Signature Consent (ESIGN / UETA)
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Under the federal ESIGN Act and the Uniform Electronic Transactions Act (UETA), you have the right to receive and sign this waiver on paper instead of electronically. By checking the box below and typing your initials, you (a) consent to use an electronic signature, (b) agree the electronic record has the same legal effect as a handwritten signature, (c) confirm you have the hardware and software needed to access and retain a copy (a modern web browser and email), and (d) understand you may withdraw consent at any time before signing by closing this page. A copy of this signed waiver will be available in your account and emailed to you.
              </p>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={esignConsent} onCheckedChange={(v) => setEsignConsent(!!v)} className="mt-0.5" />
                <span className="text-[11px] text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">I intend to sign electronically</strong> and consent to the ESIGN/UETA disclosures above.
                </span>
              </label>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Type your initials</Label>
                <Input
                  value={esignInitials}
                  onChange={(e) => setEsignInitials(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="e.g. JD"
                  maxLength={6}
                  className="bg-card border-border h-9 mt-1 font-mono text-sm uppercase tracking-widest w-32"
                />
              </div>
            </div>

            {/* Minor / parent-or-guardian co-signature */}
            <div className="mt-4 rounded-md border border-border bg-background p-3 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={isMinor} onCheckedChange={(v) => setIsMinor(!!v)} className="mt-0.5" />
                <span className="text-[11px] text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">The student is under 18 years of age.</strong> A parent or legal guardian must co-sign.
                </span>
              </label>

              {isMinor && (
                <div className="pt-2 mt-2 border-t border-border space-y-3">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Student date of birth</Label>
                    <Input
                      type="date"
                      value={studentDob}
                      onChange={(e) => setStudentDob(e.target.value)}
                      className="bg-card border-border h-9 mt-1 text-sm"
                      max={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Parent/guardian full legal name</Label>
                    <Input
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="Parent or legal guardian"
                      className="bg-card border-border h-11 mt-1 font-serif italic text-base"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Relationship to student</Label>
                    <Input
                      value={guardianRelationship}
                      onChange={(e) => setGuardianRelationship(e.target.value)}
                      placeholder="e.g. Mother, Father, Legal Guardian"
                      className="bg-card border-border h-9 mt-1 text-sm"
                    />
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox checked={guardianConsent} onCheckedChange={(v) => setGuardianConsent(!!v)} className="mt-0.5" />
                    <span className="text-[11px] text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">As the parent or legal guardian</strong>, I have read this waiver, accept its terms on behalf of the minor student, and authorize their participation in this training.
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>
        ) : course?.in_person_waiver ? (
          <div className="tactical-card border-amber-500/40 bg-amber-500/10 p-4">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wider font-bold text-amber-700 dark:text-amber-500">
                  In-Person Waiver Required
                </div>
                <p className="text-[12px] text-foreground leading-relaxed">
                  Your instructor will provide a <strong>liability waiver in person</strong> on the day of training. You must sign it before participating — failure to sign may result in being turned away with no refund.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="tactical-card p-4 text-xs text-muted-foreground">
            No course-specific waiver is required by this instructor.
          </div>
        )}

        <Button
          disabled={!canSubmit}
          onClick={handleConfirm}
          className="w-full h-13 bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-4 disabled:opacity-40"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Continue to Secure Payment · {fmt(fees.onlineTotalCents)}
        </Button>
        {waiver && !waiverReady && (
          <p className="text-[11px] text-center text-muted-foreground">Sign the waiver above to enable booking.</p>
        )}
      </div>
    </MobileShell>
  );
};

const Row = ({ label, value, muted }: { label: string; value: string; muted?: boolean }) => (
  <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className={muted ? 'text-muted-foreground' : 'text-foreground font-semibold'}>{value}</span></div>
);

export default Checkout;
