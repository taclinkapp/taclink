import { Link } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { InstructorTabBar } from '@/components/InstructorTabBar';
import { mockCourses, mockRoster } from '@/lib/mockData';
import { TrendingUp, Users, DollarSign, Calendar, ChevronRight, ShieldCheck, Plus } from 'lucide-react';
import { NotificationsBell } from '@/components/NotificationsBell';
import { InstructorInsights } from '@/components/instructor/InstructorInsights';
import { FeeInsights } from '@/components/instructor/FeeInsights';

const InstructorDashboard = () => {
  const stats = [
    { label: 'Active', value: '4', icon: Calendar },
    { label: 'Students', value: '47', icon: Users },
    { label: 'Reviews', value: '3', icon: TrendingUp, accent: true },
    { label: 'Revenue', value: '$2.8K', icon: DollarSign, primary: true },
  ];
  return (
    <MobileShell>
      <PageHeader right={<NotificationsBell className="-mr-2" />} />
      <div className="px-4 pt-2">
        <div className="flex items-center gap-3">
          <img src="https://i.pravatar.cc/150?img=12" className="h-12 w-12 rounded-full border-2 border-primary" alt="" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Good morning,</p>
            <h1 className="text-xl font-black truncate">Marcus Reyes</h1>
          </div>
          <Link
            to="/instructor/courses/new"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition"
          >
            <Plus className="h-4 w-4" /> Create Course
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-5">
          {stats.map((s) => (
            <div key={s.label} className="tactical-card p-4">
              <s.icon className={`h-4 w-4 mb-2 ${s.primary ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className={`text-2xl font-black ${s.primary ? 'text-primary' : 'text-foreground'}`}>{s.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{s.label} this month</div>
            </div>
          ))}
        </div>

        {/* Credentials shortcut */}
        <Link
          to="/instructor/credentials"
          className="mt-4 tactical-card border-primary/30 bg-gradient-to-br from-primary/15 to-transparent p-4 flex items-center gap-3 hover:border-primary/60 transition"
        >
          <div className="h-9 w-9 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold leading-snug">Credentials</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload certifications — AI verifies authenticity
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>

        {/* AI insights */}
        <div className="mt-4 space-y-3">
          <FeeInsights />
          <InstructorInsights />
        </div>

        <Section title="Upcoming Courses">
          {mockCourses.slice(0, 3).map((c) => (
            <Link key={c.id} to={`/instructor/courses/${c.id}`} className="tactical-card p-3 flex items-center gap-3 hover:border-primary/40">
              <div className="h-12 w-1 rounded-sm bg-primary" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{c.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {c.maxStudents - c.spotsRemaining}/{c.maxStudents} students
                </div>
              </div>
              <div className="text-xs font-bold uppercase text-primary">Manage</div>
            </Link>
          ))}
        </Section>

        <Section title="Recent Activity">
          {mockRoster.slice(0, 4).map((s) => (
            <div key={s.id} className="tactical-card p-3 flex items-center gap-3">
              <img src={s.photo} className="h-9 w-9 rounded-full border border-border" alt="" />
              <div className="flex-1 min-w-0">
                <div className="text-sm"><span className="font-semibold">{s.name}</span> <span className="text-muted-foreground">{s.checkedIn ? 'checked in' : 'booked a course'}</span></div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(s.bookedAt).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </Section>
      </div>
      <InstructorTabBar />
    </MobileShell>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-6">
    <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold mb-3">{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
);

export default InstructorDashboard;
