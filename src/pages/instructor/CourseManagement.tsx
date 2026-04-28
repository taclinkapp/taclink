import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { mockRoster, mockWaitlist } from '@/lib/mockData';
import { useCourse } from '@/hooks/useCourses';
import { cn } from '@/lib/utils';
import { Check, X, Bell, QrCode, AlertTriangle } from 'lucide-react';
import { computeListingFeeCents, fmt, INSTRUCTOR_LISTING_FEE_PCT } from '@/lib/fees';

const tabs = ['Roster', 'Waitlist', 'Check-In'] as const;

const CourseManagement = () => {
  const { id } = useParams();
  const { data: course, isLoading } = useCourse(id);
  const [tab, setTab] = useState<typeof tabs[number]>('Roster');

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
        {/* Non-refundable listing fee disclosure */}
        <div className="tactical-card border-primary/40 bg-primary/10 p-3 mb-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-wider font-bold">Listing Fee Paid</div>
                <div className="text-sm font-black text-primary">
                  {fmt(computeListingFeeCents(Math.round((c.bookingFee ?? 0) * 100)))}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                {Math.round(INSTRUCTOR_LISTING_FEE_PCT * 100)}% of course price was charged when this course was published.{' '}
                <strong className="text-destructive">Non-refundable</strong> — not returned for cancellations, edits, unpublish, or zero bookings.
              </p>
            </div>
          </div>
        </div>
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
