import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, FileText, Loader2, ShieldCheck, Lock } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { computeFees, fmt } from '@/lib/fees';
import { HowPaymentsWorkCard } from '@/components/HowPaymentsWorkCard';
import { sendAppEmail } from '@/lib/appEmail';
import { cancelDeadline } from '@/lib/cancellation';
import { EscrowCheckout } from '@/components/student/EscrowCheckout';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';

type Course = {
  id: string;
  title: string;
  instructor_id: string;
  city: string | null;
  state: string | null;
  starts_at: string | null;
  price_cents: number;
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

  // Created booking + Stripe Embedded Checkout takeover
  const [bookingId, setBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: c, error: cErr } = await supabase
        .from('courses')
        .select('id, title, instructor_id, city, state, starts_at, price_cents')
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
      if (cancelled) return;
      setCourse((c as Course) ?? null);
      setWaiver(w);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (profile?.display_name && !signedName) setSignedName(profile.display_name);
  }, [profile?.display_name]); // eslint-disable-line react-hooks/exhaustive-deps

  const fees = useMemo(() => computeFees(course?.price_cents ?? 0), [course]);

  const waiverReady = !waiver || (agreeWaiver && signedName.trim().length >= 3);
  const canSubmit = !!user && !!course && agreeRisk && waiverReady && !submitting;

  const handleConfirm = async () => {
    if (!user) { toast.error('Please sign in to book'); return; }
    if (!course) return;
    setSubmitting(true);
    try {
      // Create the booking record up-front in pending_payment state.
      // The Stripe webhook flips it to held_in_escrow once payment lands.
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
      if (bErr) throw bErr;

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
          },
        });
      }

      // Hand off to Stripe Embedded Checkout.
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
        <PageHeader title="Confirm Booking" back />
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
        <PageHeader title="Confirm Booking" back />
        <div className="px-4 py-12 text-center text-muted-foreground text-sm">Course not found.</div>
      </MobileShell>
    );
  }

  // Stripe Embedded Checkout takeover after the booking is created.
  if (bookingId) {
    const returnUrl = `${window.location.origin}/student/checkout/${bookingId}/return`;
    return (
      <MobileShell withTabBar={false}>
        <PaymentTestModeBanner />
        <PageHeader title="Secure Payment" back />
        <div className="px-4 py-4 space-y-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-primary" /> Charged securely by Stripe — your card never touches our servers.
          </div>
          <EscrowCheckout bookingId={bookingId} returnUrl={returnUrl} />
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell withTabBar={false}>
      <PaymentTestModeBanner />
      <PageHeader title="Confirm Booking" back />
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
            <Row label="Deposit (10%) — held in escrow" value={fmt(fees.instructorDepositCents)} />
            <div className="border-t border-border pt-2 mt-2 flex justify-between">
              <span className="font-bold">Charged today by Stripe</span>
              <span className="font-black text-primary text-lg">{fmt(fees.onlineTotalCents)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-dashed border-border mt-2">
              <span className="text-muted-foreground">Balance due in person</span>
              <span className="font-semibold">{fmt(fees.dueInPersonCents)}</span>
            </div>
          </div>
          <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-[11px] text-muted-foreground leading-relaxed">
            TacLink charges <strong className="text-foreground">{fmt(fees.onlineTotalCents)}</strong> today through Stripe. We hold the 10% in escrow and release it to your instructor 24 hours after they scan you in at the course. If they cancel or no-show, you're refunded in full within 48 hours. Remaining balance is paid in person.
          </div>
        </div>

        {/* Risk acknowledgement */}
        <div className="tactical-card p-4 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              The platform fee is <span className="text-foreground font-bold">non-refundable</span>. The 10% deposit is fully refundable if the instructor cancels or no-shows.
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
