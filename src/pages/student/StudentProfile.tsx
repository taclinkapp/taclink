import { Link, useNavigate } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { StudentTabBar } from '@/components/StudentTabBar';
import { mockBookings, mockCourses } from '@/lib/mockData';
import { Settings, ChevronRight } from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { WatermarkedAvatar } from '@/components/WatermarkedAvatar';

const StudentProfile = () => {
  const nav = useNavigate();
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
          <img src="https://i.pravatar.cc/150?img=14" className="h-20 w-20 rounded-full border-2 border-primary object-cover" alt="" />
          <div>
            <h2 className="text-xl font-black">James Kowalski</h2>
            <p className="text-xs text-muted-foreground">Member since April 2026</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-6">
          {[
            { label: 'Courses', value: '7' },
            { label: 'Instructors', value: '4' },
            { label: 'Reviews', value: '5' },
          ].map((s) => (
            <div key={s.label} className="tactical-card p-3 text-center">
              <div className="text-xl font-black text-primary">{s.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <Section title="Training History">
          {mockBookings.slice(0, 3).map((b) => (
            <Link key={b.id} to={`/student/booking/${b.id}`} className="tactical-card p-3 flex items-center gap-3 hover:border-primary/40">
              <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center text-primary font-bold text-xs">
                {b.course.category.slice(0, 3).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{b.course.title}</div>
                <div className="text-xs text-muted-foreground">{new Date(b.course.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </Section>

        <Section title="Saved Instructors">
          {mockCourses.slice(0, 2).map((c) => (
            <div key={c.id} className="tactical-card p-3 flex items-center gap-3">
              <WatermarkedAvatar src={c.instructorPhoto} size={40} className="border border-border" alt={c.instructorName} />
              <div className="flex-1">
                <div className="flex items-center gap-1 text-sm font-semibold">{c.instructorName} {c.instructorVerified && <VerifiedBadge />}</div>
                <div className="text-xs text-muted-foreground">{c.city}, {c.state}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </Section>
      </div>
      <StudentTabBar />
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
