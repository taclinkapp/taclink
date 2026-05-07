import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { StudentTabBar } from '@/components/StudentTabBar';
import { Settings, ChevronRight, Gift } from 'lucide-react';
import { InviteFriendsSheet } from '@/components/InviteFriendsSheet';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { OperatorProfileMini } from '@/components/operator/OperatorProfileMini';

type HistoryRow = {
  id: string;
  course_id: string;
  course_title: string;
  course_category: string | null;
  course_starts_at: string | null;
};

const StudentProfile = () => {
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [stats, setStats] = useState({ courses: 0, instructors: 0, reviews: 0 });
  const [history, setHistory] = useState<HistoryRow[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: bookings }, { count: reviewCount }] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, course_id, courses!inner(id, title, category, starts_at, instructor_id)')
          .eq('student_id', user.id)
          .order('booked_at', { ascending: false }),
        supabase
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', user.id),
      ]);
      if (cancelled) return;
      const rows = (bookings ?? []) as any[];
      const instructorIds = new Set<string>();
      const hist: HistoryRow[] = rows.map((r) => {
        if (r.courses?.instructor_id) instructorIds.add(r.courses.instructor_id);
        return {
          id: r.id,
          course_id: r.course_id,
          course_title: r.courses?.title ?? 'Course',
          course_category: r.courses?.category ?? null,
          course_starts_at: r.courses?.starts_at ?? null,
        };
      });
      setHistory(hist.slice(0, 3));
      setStats({
        courses: rows.length,
        instructors: instructorIds.size,
        reviews: reviewCount ?? 0,
      });
    })();
    return () => { cancelled = true; };
  }, [user]);

  const memberSince = useMemo(() => {
    const created = (profile as any)?.created_at ?? user?.created_at;
    if (!created) return '';
    return new Date(created).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [profile, user]);

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Student';
  const photo = profile?.photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`;

  return (
    <MobileShell>
      <PageHeader
        title="Profile"
        right={
          <button onClick={() => nav('/student/settings')} className="text-muted-foreground hover:text-primary p-2 -mr-2">
            <Settings className="h-5 w-5" />
          </button>
        }
      />
      <div className="px-4 py-6">
        <div className="flex items-center gap-4">
          <img src={photo} className="h-20 w-20 rounded-full border-2 border-primary object-cover" alt="" />
          <div>
            <h2 className="text-xl font-black">{displayName}</h2>
            {memberSince && <p className="text-xs text-muted-foreground">Member since {memberSince}</p>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-6">
          {[
            { label: 'Courses', value: stats.courses },
            { label: 'Instructors', value: stats.instructors },
            { label: 'Reviews', value: stats.reviews },
          ].map((s) => (
            <div key={s.label} className="tactical-card p-3 text-center">
              <div className="text-xl font-black text-primary">{s.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <Section title="Invite & Earn">
          <button
            onClick={() => setInviteOpen(true)}
            className="tactical-card w-full p-4 flex items-center gap-3 hover:border-primary/40 text-left"
          >
            <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center text-primary">
              <Gift className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">Invite friends, get a free booking</div>
              <div className="text-xs text-muted-foreground">When they book their first course, you score a free one.</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </Section>

        <Section title="Training History">
          {history.length === 0 ? (
            <div className="tactical-card p-4 text-center text-xs text-muted-foreground">
              No bookings yet. Find a course to get started.
            </div>
          ) : history.map((b) => (
            <Link key={b.id} to={`/student/booking/${b.id}`} className="tactical-card p-3 flex items-center gap-3 hover:border-primary/40">
              <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center text-primary font-bold text-xs">
                {(b.course_category ?? 'CRS').slice(0, 3).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{b.course_title}</div>
                {b.course_starts_at && (
                  <div className="text-xs text-muted-foreground">
                    {new Date(b.course_starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </Section>
      </div>
      <StudentTabBar />
      <InviteFriendsSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        rewardLabel="1 free booking"
      />
    </MobileShell>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-6">
    <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold mb-3">{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
);

export default StudentProfile;
