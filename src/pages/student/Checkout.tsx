import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CreditCard, Lock, AlertTriangle, FileText, Loader2, ShieldCheck, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { computeFees, fmt } from '@/lib/fees';
import { Link } from 'react-router-dom';

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
  const hasPaymentMethod = !!profile?.payment_method_added;

  const waiverReady = !waiver || (agreeWaiver && signedName.trim().length >= 3);
  const canSubmit = !!user && !!course && agreeRisk && waiverReady && hasPaymentMethod && !submitting;

  const handleConfirm = async () => {
    if (!user) { toast.error('Please sign in to book'); return; }
    if (!course) return;
    setSubmitting(true);
    try {
      // 1) Create the booking with fee snapshot.
      // NEW: TacLink only charges the $25 platform fee online. The 10% deposit
      // is owed directly to the instructor (Cash App / Venmo / PayPal / Zelle)
      // within 24 hours, then balance in person.
      const onlineNowCents = fees.platformFeeCents; // $25 only
      const depositToInstructorCents = fees.instructorDepositCents; // 10%, paid direct
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { data: booking, error: bErr } = await supabase
        .from('bookings')
        .insert({
          student_id: user.id,
          course_id: course.id,
          status: 'reserved',
          course_price_cents: fees.coursePriceCents,
          platform_fee_cents: fees.platformFeeCents,
          instructor_deposit_cents: depositToInstructorCents,
          due_in_person_cents: fees.dueInPersonCents,
          online_total_cents: onlineNowCents,
          deposit_status: depositToInstructorCents > 0 ? 'pending_send' : 'not_required',
          deposit_amount_cents: depositToInstructorCents,
          deposit_expires_at: depositToInstructorCents > 0 ? expiresAt : null,
        })
        .select('id')
        .single();
      if (bErr) throw bErr;

      // 2) Ledger entry for AI insights / instructor reporting
      await supabase.from('booking_fees').insert({
        booking_id: booking.id,
        course_id: course.id,
        student_id: user.id,
        instructor_id: course.instructor_id,
        course_price_cents: fees.coursePriceCents,
        platform_fee_cents: fees.platformFeeCents,
        instructor_deposit_cents: depositToInstructorCents,
        due_in_person_cents: fees.dueInPersonCents,
        online_total_cents: onlineNowCents,
      });

      // 3) If a published waiver exists, store the signature. Roll back on failure.
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

      toast.success('Booking confirmed');
      nav(`/student/booking-success/${course.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not complete booking');
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

  return (
    <MobileShell withTabBar={false}>
      <PageHeader title="Confirm Booking" back />
      <div className="px-4 py-4 space-y-4">
        {/* Summary */}
        <div className="tactical-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Course</div>
          <h2 className="font-bold">{course.title}</h2>
          <div className="text-xs text-muted-foreground mt-1">
            {course.starts_at ? new Date(course.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBD'}
            {course.city ? ` · ${course.city}` : ''}{course.state ? `, ${course.state}` : ''}
          </div>
        </div>

        {/* Price breakdown — checkout shows full math */}
        <div className="tactical-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Price Breakdown</div>
          <div className="space-y-2 text-sm">
            <Row label="Course price" value={fmt(fees.coursePriceCents)} muted />
            <Row label="TacLink platform fee" value={fmt(fees.platformFeeCents)} />
            <div className="border-t border-border pt-2 mt-2 flex justify-between">
              <span className="font-bold">Charged today</span>
              <span className="font-black text-primary text-lg">{fmt(fees.platformFeeCents)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-dashed border-border mt-2">
              <span className="text-muted-foreground">Deposit (10%) — sent direct to instructor within 24h</span>
              <span className="font-semibold">{fmt(fees.instructorDepositCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance due in person</span>
              <span className="font-semibold">{fmt(fees.dueInPersonCents)}</span>
            </div>
          </div>
          <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-[11px] text-muted-foreground leading-relaxed">
            TacLink only charges the <strong className="text-foreground">{fmt(fees.platformFeeCents)} platform fee</strong> today. After booking, you'll send the <strong className="text-foreground">{fmt(fees.instructorDepositCents)} deposit</strong> directly to your instructor via Cash App, Venmo, PayPal, or Zelle — they get 100% of it. Remaining balance is paid in person.
          </div>
        </div>

        {/* Payment method gate */}
        {hasPaymentMethod ? (
          <div className="tactical-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5" /> Payment Method
              <span className="ml-auto text-[10px] flex items-center gap-1"><Lock className="h-3 w-3" /> Secure</span>
            </div>
            <div className="text-sm flex items-center justify-between">
              <span>Card on file will be charged {fmt(fees.platformFeeCents)}</span>
              <Link to="/student/payment-methods" className="text-xs text-primary font-bold uppercase">Change</Link>
            </div>
          </div>
        ) : (
          <Link
            to="/student/payment-methods"
            className="tactical-card border-primary/40 bg-primary/5 p-4 flex items-center gap-3 hover:border-primary transition"
          >
            <Wallet className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-bold">Add a payment method to continue</div>
              <div className="text-xs text-muted-foreground mt-0.5">Required to charge the platform fee.</div>
            </div>
            <span className="text-xs text-primary font-bold uppercase">Add</span>
          </Link>
        )}

        {/* Risk acknowledgement (always shown) */}
        <div className="tactical-card p-4 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              Booking fees are <span className="text-foreground font-bold">non-refundable</span>. Training involves inherent risks.
            </div>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox checked={agreeRisk} onCheckedChange={(v) => setAgreeRisk(!!v)} className="mt-0.5" />
            <span className="text-xs text-muted-foreground leading-relaxed">
              I understand this training involves inherent risks including risk of injury or death.
            </span>
          </label>
        </div>

        {/* Course-specific waiver — required when published */}
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
          Confirm & Pay {fmt(fees.platformFeeCents)}
        </Button>
        {!hasPaymentMethod && (
          <p className="text-[11px] text-center text-muted-foreground">Add a payment method above to enable booking.</p>
        )}
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
