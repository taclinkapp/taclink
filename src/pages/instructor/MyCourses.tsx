import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { InstructorTabBar } from '@/components/InstructorTabBar';
import { useInstructorCourses } from '@/hooks/useCourses';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Users, ChevronRight, XCircle } from 'lucide-react';
import { CategoryPill } from '@/components/CategoryPill';
import { cn } from '@/lib/utils';

const tabs = ['Active', 'Draft', 'Past'] as const;

const MyCourses = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<typeof tabs[number]>('Active');
  const { data: courses = [], isLoading } = useInstructorCourses(user?.id);

  const now = Date.now();
  const filtered = courses.filter((c) => {
    const startMs = c.date ? new Date(c.date).getTime() : 0;
    const isPast = startMs && startMs < now;
    const isCancelled = c.status === 'cancelled';
    if (tab === 'Active') return c.status === 'active' && !isPast;
    if (tab === 'Draft') return c.status === 'draft';
    return isPast || isCancelled;
  });

  return (
    <MobileShell>
      <PageHeader
        title="My Courses"
        right={
          <Link to="/instructor/courses/new" className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1 amber-glow">
            <Plus className="h-3.5 w-3.5" /> New
          </Link>
        }
      />
      <div className="px-4 pt-3">
        <div className="flex bg-card border border-border rounded-sm p-0.5">
          {tabs.map((t) => (
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
        {isLoading ? (
          <div className="text-center text-muted-foreground text-sm py-12">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-12">
            No {tab.toLowerCase()} courses.{tab === 'Active' && ' Tap New to publish your first course.'}
          </div>
        ) : (
          filtered.map((c) => (
            <Link key={c.id} to={`/instructor/courses/${c.id}`} className="block tactical-card p-4 hover:border-primary/40">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CategoryPill category={c.category} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-success">{c.status}</span>
                  </div>
                  <h3 className="font-bold leading-tight">{c.title}</h3>
                  <div className="text-xs text-muted-foreground mt-1.5">
                    {c.date ? new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    {c.startTime && ` · ${c.startTime}`}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-xs">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span className="font-bold">0/{c.maxStudents}</span>
                    <span className="text-muted-foreground">enrolled</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))
        )}
      </div>
      <InstructorTabBar />
    </MobileShell>
  );
};

export default MyCourses;
