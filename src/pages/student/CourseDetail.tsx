import { useNavigate, useParams } from 'react-router-dom';
import { mockReviews } from '@/lib/mockData';
import { useCourse } from '@/hooks/useCourses';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { CategoryPill } from '@/components/CategoryPill';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { Button } from '@/components/ui/button';
import { CourseMap } from '@/components/CourseMap';
import { Calendar, Clock, MapPin, Users, Star, Crosshair, AlertCircle, MessageSquare } from 'lucide-react';

const CourseDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: course, isLoading } = useCourse(id);

  if (isLoading) {
    return (
      <MobileShell withTabBar={false}>
        <PageHeader back />
        <div className="px-4 py-12 text-center text-muted-foreground text-sm">Loading…</div>
      </MobileShell>
    );
  }

  if (!course) {
    return (
      <MobileShell withTabBar={false}>
        <PageHeader back />
        <div className="px-4 py-12 text-center text-muted-foreground text-sm">Course not found.</div>
      </MobileShell>
    );
  }

  const isFull = course.spotsRemaining === 0;

  return (
    <MobileShell withTabBar={false}>
      <div className="pb-28">
        <PageHeader back />
        {/* Hero */}
        <div className="relative h-44 bg-gradient-to-br from-primary/20 via-surface to-background overflow-hidden">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(hsl(0 0% 16% / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 16% / 0.5) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} />
          <Crosshair className="absolute right-4 top-4 h-32 w-32 text-primary/10" strokeWidth={1} />
          <div className="absolute bottom-4 left-4">
            <CategoryPill category={course.category} />
            <h1 className="text-2xl font-black mt-2 max-w-[80%] leading-tight">{course.title}</h1>
          </div>
        </div>

        {/* Instructor card */}
        <div className="px-4 -mt-6 relative z-10">
          <div className="tactical-card p-4 flex items-center gap-3">
            <img src={course.instructorPhoto} className="h-14 w-14 rounded-full object-cover border-2 border-primary" alt="" />
            <div className="flex-1">
              <div className="flex items-center gap-1">
                <span className="font-bold">{course.instructorName}</span>
                {course.instructorVerified && <VerifiedBadge />}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-primary text-primary" />
                <span className="font-semibold text-foreground">{course.instructorRating}</span>
                <span>· 124 reviews</span>
              </div>
            </div>
            <Button
              onClick={() => nav(`/student/messages/${course.instructorId}?courseId=${course.id}`)}
              variant="outline"
              size="sm"
              className="bg-card border-border text-xs gap-1.5"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Message
            </Button>
          </div>
        </div>

        {/* Info grid */}
        <div className="px-4 mt-4 grid grid-cols-2 gap-2">
          {[
            { icon: Calendar, label: new Date(course.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) },
            { icon: Clock, label: `${course.startTime} – ${course.endTime}` },
            { icon: MapPin, label: `${course.city}, ${course.state}` },
            { icon: Users, label: `${course.spotsRemaining}/${course.maxStudents} spots` },
          ].map((item, i) => (
            <div key={i} className="tactical-card p-3 flex items-center gap-2.5">
              <item.icon className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-semibold truncate">{item.label}</span>
            </div>
          ))}
        </div>

        {/* About */}
        <Section title="About This Course">
          <p className="text-sm text-muted-foreground leading-relaxed">{course.description}</p>
        </Section>

        <Section title="What You'll Learn">
          <ul className="space-y-2">
            {course.whatYoullLearn.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Crosshair className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Prerequisites & Equipment">
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Prerequisites</div>
              <p className="text-foreground">{course.prerequisites}</p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Equipment Required</div>
              <p className="text-foreground">{course.equipment}</p>
            </div>
          </div>
        </Section>

        <Section title="Location">
          <div className="tactical-card overflow-hidden">
            <div className="relative h-44">
              <CourseMap courses={[course]} className="h-full w-full" interactive={false} zoom={11} />
            </div>
            <div className="p-3 flex items-start gap-2">
              <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-semibold text-foreground">{course.address}</div>
                <div className="text-muted-foreground">{course.city}, {course.state}</div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Reviews">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-5 w-5 fill-primary text-primary" />
            <span className="text-2xl font-black">{course.instructorRating}</span>
            <span className="text-sm text-muted-foreground">· 124 reviews</span>
          </div>
          <div className="space-y-3">
            {mockReviews.map((r) => (
              <div key={r.id} className="tactical-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <img src={r.studentPhoto} className="h-8 w-8 rounded-full" alt="" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{r.studentName}</div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < r.rating ? 'fill-primary text-primary' : 'text-border'}`} />
                      ))}
                      <span className="text-[10px] text-muted-foreground ml-1">{r.date}</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{r.comment}</p>
              </div>
            ))}
          </div>
        </Section>

        {isFull && (
          <div className="mx-4 mb-4 tactical-card border-destructive/30 bg-destructive/10 p-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-xs text-destructive font-semibold">This course is full. Join the waitlist below.</span>
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 inset-x-0 bg-surface border-t border-border z-40">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Booking Fee</div>
            <div className="text-2xl font-black text-primary">${course.bookingFee}</div>
          </div>
          <Button
            onClick={() => nav(`/student/checkout/${course.id}`)}
            className="flex-1 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold amber-glow"
          >
            {isFull ? 'Join Waitlist' : 'Book Now'}
          </Button>
        </div>
      </div>
    </MobileShell>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="px-4 mt-6">
    <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold mb-3">{title}</h2>
    {children}
  </section>
);

export default CourseDetail;
