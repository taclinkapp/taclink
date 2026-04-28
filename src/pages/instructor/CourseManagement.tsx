import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { mockRoster, mockWaitlist } from '@/lib/mockData';
import { useCourse } from '@/hooks/useCourses';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Check, X, Bell, QrCode, AlertTriangle, Receipt, ChevronDown, Copy } from 'lucide-react';
import { computeListingFeeCents, fmt, INSTRUCTOR_LISTING_FEE_PCT } from '@/lib/fees';
import { toast } from 'sonner';

const tabs = ['Roster', 'Waitlist', 'Check-In'] as const;

const CourseManagement = () => {
  const { id } = useParams();
  const { data: course, isLoading } = useCourse(id);
  const [tab, setTab] = useState<typeof tabs[number]>('Roster');
  const [showReceipt, setShowReceipt] = useState(false);

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
  const checkedIn = mockRoster.filter((s) => s.checkedIn).length;

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
          <div>
            <div className="tactical-card p-5 text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1">
                <QrCode className="h-3 w-3" /> Display this QR for students to scan
              </div>
              <div className="mx-auto h-56 w-56 bg-white p-3 rounded-sm mt-3">
                <div className="h-full w-full" style={{
                  backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)',
                  backgroundSize: '14px 14px',
                  backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0',
                }} />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold mb-2">Live Check-Ins</h3>
              <div className="space-y-2">
                {mockRoster.filter((s) => s.checkedIn).map((s) => (
                  <div key={s.id} className="tactical-card p-3 flex items-center gap-3 border-success/20 bg-success/5">
                    <img src={s.photo} className="h-9 w-9 rounded-full" alt="" />
                    <div className="flex-1 text-sm font-semibold">{s.name}</div>
                    <Check className="h-4 w-4 text-success" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
};

export default CourseManagement;
