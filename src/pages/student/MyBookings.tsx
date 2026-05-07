import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { StudentTabBar } from '@/components/StudentTabBar';
import { CategoryPill } from '@/components/CategoryPill';
import { QrCode, Calendar, MapPin, Star, Loader2, XCircle, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WatermarkedAvatar } from '@/components/WatermarkedAvatar';
import { HowPaymentsWorkCard } from '@/components/HowPaymentsWorkCard';
import { CancelGraceBadge } from '@/components/student/CancelGraceBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type BookingItem = {
  id: string;
  status: string;
  booked_at: string | null;
  attended_at: string | null;
  cancellation_cutoff_hours: number | null;
  deposit_status: string | null;
  online_total_cents: number | null;
  course_price_cents: number | null;
  platform_fee_cents: number | null;
  updated_at: string | null;
  course: {
    id: string;
    title: string;
    category: string | null;
    city: string | null;
    starts_at: string | null;
    ends_at: string | null;
    cover_image_url: string | null;
    instructor: { id: string; display_name: string | null; avatar_url: string | null } | null;
  } | null;
  reviewed?: boolean;
};

const MyBookings = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingItem[]>([]);

  useEffect(() => {
    if (!user) { setBookings([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, status, booked_at, attended_at, cancellation_cutoff_hours,
          course:courses (
            id, title, category, city, starts_at, ends_at, cover_image_url, instructor_id
          )
        `)
        .eq('student_id', user.id)
        .neq('status', 'cancelled')
        .order('booked_at', { ascending: false });
      if (error) { toast.error(error.message); setLoading(false); return; }

      const rows = (data ?? []) as any[];
      const instructorIds = Array.from(new Set(rows.map((r) => r.course?.instructor_id).filter(Boolean)));
      const courseIds = Array.from(new Set(rows.map((r) => r.course?.id).filter(Boolean)));

      const [{ data: profiles }, { data: reviews }] = await Promise.all([
        instructorIds.length
          ? supabase.from('profiles').select('id, display_name, avatar_url').in('id', instructorIds)
          : Promise.resolve({ data: [] as any[] }),
        courseIds.length
          ? supabase.from('reviews').select('course_id').eq('student_id', user.id).in('course_id', courseIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const reviewedSet = new Set((reviews ?? []).map((r: any) => r.course_id));

      const items: BookingItem[] = rows.map((r) => {
        const inst = r.course?.instructor_id ? profileMap.get(r.course.instructor_id) : null;
        return {
          id: r.id,
          status: r.status,
          booked_at: r.booked_at,
          attended_at: r.attended_at,
          cancellation_cutoff_hours: r.cancellation_cutoff_hours,
          course: r.course
            ? {
                id: r.course.id,
                title: r.course.title,
                category: r.course.category,
                city: r.course.city,
                starts_at: r.course.starts_at,
                ends_at: r.course.ends_at,
                cover_image_url: r.course.cover_image_url,
                instructor: inst
                  ? { id: inst.id, display_name: inst.display_name, avatar_url: inst.avatar_url }
                  : null,
              }
            : null,
          reviewed: r.course?.id ? reviewedSet.has(r.course.id) : false,
        };
      });

      if (!cancelled) {
        setBookings(items);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const list = useMemo(() => {
    const now = Date.now();
    return bookings.filter((b) => {
      const ends = b.course?.ends_at ?? b.course?.starts_at ?? null;
      const endsMs = ends ? new Date(ends).getTime() : null;
      const isPast = b.attended_at != null || (endsMs != null && endsMs < now);
      return tab === 'upcoming' ? !isPast : isPast;
    });
  }, [bookings, tab]);

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
        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-12">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Loading…
          </div>
        ) : list.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-12">No {tab} bookings yet.</div>
        ) : list.map((b) => {
          const startsAt = b.course?.starts_at ?? null;
          const dateLabel = startsAt
            ? new Date(startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : 'TBD';
          return (
            <Link key={b.id} to={`/student/booking/${b.id}`} className="block tactical-card p-4 hover:border-primary/40 transition">
              <div className="flex items-start gap-3">
                <WatermarkedAvatar
                  src={b.course?.instructor?.avatar_url ?? undefined}
                  size={48}
                  className="border border-border"
                  alt={b.course?.instructor?.display_name ?? 'Instructor'}
                />
                <div className="flex-1 min-w-0">
                  {b.course?.category && <CategoryPill category={b.course.category} className="mb-1.5" />}
                  <h3 className="font-bold leading-tight truncate">{b.course?.title ?? 'Course'}</h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{dateLabel}</span>
                    {b.course?.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{b.course.city}</span>}
                  </div>
                  {tab === 'upcoming' && (
                    <div className="mt-1.5">
                      <CancelGraceBadge
                        startsAt={startsAt}
                        bookedAt={b.booked_at}
                        cutoffHours={b.cancellation_cutoff_hours ?? undefined}
                      />
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
