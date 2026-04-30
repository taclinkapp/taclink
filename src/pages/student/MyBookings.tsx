import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { StudentTabBar } from '@/components/StudentTabBar';
import { mockBookings } from '@/lib/mockData';
import { CategoryPill } from '@/components/CategoryPill';
import { QrCode, Calendar, MapPin, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WatermarkedAvatar } from '@/components/WatermarkedAvatar';
import { HowPaymentsWorkCard } from '@/components/HowPaymentsWorkCard';
import { CancelGraceBadge } from '@/components/student/CancelGraceBadge';

const MyBookings = () => {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const list = mockBookings.filter((b) => b.status === tab);

  return (
    <MobileShell>
      <PageHeader title="My Bookings" />
      <div className="px-4 pt-3 space-y-3">
        <HowPaymentsWorkCard audience="student" />
        <div className="flex bg-card border border-border rounded-sm p-0.5">
          {(['upcoming', 'past'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 h-9 text-xs font-bold uppercase tracking-wider rounded-sm transition',
                tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 py-4 space-y-3">
        {list.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-12">No {tab} bookings yet.</div>
        ) : list.map((b) => {
          const startsAt = b.course?.date && b.course?.startTime
            ? new Date(`${b.course.date}T${b.course.startTime}:00`).toISOString()
            : null;
          return (
          <Link key={b.id} to={`/student/booking/${b.id}`} className="block tactical-card p-4 hover:border-primary/40 transition">
            <div className="flex items-start gap-3">
              <WatermarkedAvatar src={b.course.instructorPhoto} size={48} className="border border-border" alt={b.course.instructorName} />
              <div className="flex-1 min-w-0">
                <CategoryPill category={b.course.category} className="mb-1.5" />
                <h3 className="font-bold leading-tight truncate">{b.course.title}</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(b.course.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{b.course.city}</span>
                </div>
                {tab === 'upcoming' && (
                  <div className="mt-1.5">
                    <CancelGraceBadge startsAt={startsAt} bookedAt={b.bookedAt} />
                  </div>
                )}
              </div>
              {tab === 'upcoming' ? (
                <div className="h-10 w-10 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center">
                  <QrCode className="h-5 w-5 text-primary" />
                </div>
              ) : !b.reviewed ? (
                <div className="h-10 px-3 rounded-md bg-primary text-primary-foreground flex items-center gap-1 text-xs font-bold">
                  <Star className="h-3.5 w-3.5" /> Review
                </div>
              ) : (
                <span className="text-[10px] text-success font-bold uppercase">Reviewed</span>
              )}
            </div>
          </Link>
          );
        })}
      </div>
      <StudentTabBar />
    </MobileShell>
  );
};

export default MyBookings;
