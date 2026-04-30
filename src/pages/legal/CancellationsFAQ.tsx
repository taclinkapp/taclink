import { MobileShell, PageHeader } from '@/components/MobileShell';
import { Clock, AlertTriangle, CheckCircle2, ShieldCheck, User, GraduationCap } from 'lucide-react';

const TIERS = [
  {
    lead: '7+ days before course',
    grace: '72 hours',
    example: 'Booked 10 days out → you have 72 hours from booking to cancel for a full refund.',
    tone: 'success' as const,
  },
  {
    lead: '3–7 days before course',
    grace: '48 hours',
    example: 'Booked 5 days out → you have 48 hours from booking to cancel for a full refund.',
    tone: 'success' as const,
  },
  {
    lead: '1–3 days before course',
    grace: '24 hours',
    example: 'Booked 2 days out → you have 24 hours from booking to cancel for a full refund.',
    tone: 'warning' as const,
  },
  {
    lead: 'Less than 24 hours before course',
    grace: 'No grace window',
    example: 'Booked 6 hours before start → cancellations are not eligible for a refund.',
    tone: 'destructive' as const,
  },
];

const toneClasses = {
  success: 'border-success/40 bg-success/10',
  warning: 'border-amber-500/40 bg-amber-500/10',
  destructive: 'border-destructive/40 bg-destructive/10',
};
const toneText = {
  success: 'text-success',
  warning: 'text-amber-500',
  destructive: 'text-destructive',
};

const CancellationsFAQ = () => (
  <MobileShell withTabBar={false}>
    <PageHeader title="Cancellation Policy" back />
    <div className="px-4 py-4 space-y-4 pb-12">
      {/* Hero */}
      <section className="tactical-card p-5 bg-gradient-to-br from-primary/15 via-card to-card border border-primary/20">
        <div className="flex items-center gap-2 text-primary text-[10px] font-bold uppercase tracking-[0.2em]">
          <ShieldCheck className="h-3.5 w-3.5" /> Refund Rules at a Glance
        </div>
        <h2 className="text-lg font-extrabold mt-1 leading-tight">
          Your cancellation window depends on how early you booked
        </h2>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          The earlier you book, the more time you get to cancel for a full refund. The exact deadline
          is shown on your booking detail page and on My Bookings as a live countdown.
        </p>
      </section>

      {/* Student tiers */}
      <section>
        <h3 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-2 px-1">
          <GraduationCap className="h-3.5 w-3.5" /> If you're a student
        </h3>
        <div className="space-y-2">
          {TIERS.map((t) => (
            <div key={t.lead} className={`tactical-card border ${toneClasses[t.tone]} p-3`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-xs font-bold">{t.lead}</div>
                <div className={`text-[11px] font-bold uppercase tracking-wider ${toneText[t.tone]}`}>
                  {t.grace}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1.5">
                <Clock className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{t.example}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Within / outside window */}
      <section className="tactical-card p-4">
        <h3 className="text-sm font-bold mb-3">What happens when you cancel?</h3>
        <div className="space-y-3 text-xs leading-relaxed">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-foreground">Within your grace window</div>
              <div className="text-muted-foreground">
                <strong className="text-foreground">Full refund</strong> — $25 platform fee + 100% of the course price returned to your card via Stripe within 48 hours.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-foreground">After your grace window or no-show</div>
              <div className="text-muted-foreground">
                You receive <strong className="text-foreground">90% of the course price</strong> back. The instructor keeps the remaining 10% as compensation for the lost slot. The $25 platform fee is non-refundable.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Instructor section */}
      <section>
        <h3 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-2 px-1">
          <User className="h-3.5 w-3.5" /> If you're an instructor
        </h3>
        <div className="tactical-card p-4 space-y-3 text-xs leading-relaxed">
          <p className="text-muted-foreground">
            When you cancel a course, every enrolled student is fully refunded — always.
            Your outcome depends on timing relative to the course start:
          </p>
          <div className="space-y-2">
            <div className="border border-success/40 bg-success/10 rounded-md p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-success mb-1">
                48+ hours before start
              </div>
              <div className="text-muted-foreground">
                Students are fully refunded. No strike, no payout penalty.
              </div>
            </div>
            <div className="border border-destructive/40 bg-destructive/10 rounded-md p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-destructive mb-1">
                Less than 48 hours before start
              </div>
              <div className="text-muted-foreground">
                Students are fully refunded, you receive no payout for the cancelled bookings, and 1 strike
                is added to your account. Repeated late cancellations may suspend your ability to publish.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Edge cases */}
      <section className="tactical-card p-4 space-y-3">
        <h3 className="text-sm font-bold">Special cases</h3>
        <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
          <p>
            <strong className="text-foreground">Weather, illness, or mutual reschedule:</strong>{' '}
            We encourage rescheduling with the same instructor at no additional platform fee.
          </p>
          <p>
            <strong className="text-foreground">Instructor no-show or fraud/safety incident:</strong>{' '}
            Full refund (platform fee + deposit) regardless of timing.
          </p>
          <p>
            <strong className="text-foreground">Quality complaints after attending:</strong>{' '}
            Reviewed case-by-case. Released deposits are not clawed back automatically.
          </p>
        </div>
      </section>

      <p className="text-[11px] text-muted-foreground text-center px-4">
        Full legal terms in <a href="/legal/terms" className="text-primary underline">Terms of Service §6</a>.
      </p>
    </div>
  </MobileShell>
);

export default CancellationsFAQ;
