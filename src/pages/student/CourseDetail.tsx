import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCourse } from '@/hooks/useCourses';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { CategoryPill } from '@/components/CategoryPill';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { Button } from '@/components/ui/button';
import { CourseMap } from '@/components/CourseMap';
import { Calendar, Clock, MapPin, Users, Star, Crosshair, AlertCircle, Lock } from 'lucide-react';
import { WatermarkedAvatar } from '@/components/WatermarkedAvatar';

const CourseDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: course, isLoading } = useCourse(id);

  const { data: reviews = [] } = useQuery({
    queryKey: ['course_reviews', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, student_id, profiles:student_id(display_name, photo_url)')
        .eq('course_id', id as string)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        studentName: r.profiles?.display_name ?? 'Student',
        studentPhoto: r.profiles?.photo_url ?? '',
        rating: r.rating,
        comment: r.comment ?? '',
        date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }));
    },
  });
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
        <div className="relative h-56 bg-surface overflow-hidden">
          {course.heroImage ? (
            <img
              src={course.heroImage}
              alt={course.title}
              loading="eager"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-surface to-background" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <Crosshair className="absolute right-4 top-4 h-24 w-24 text-primary/20" strokeWidth={1} />
          <div className="absolute bottom-4 left-4 right-4">
            <CategoryPill category={course.category} />
            <h1 className="text-2xl font-black mt-2 max-w-[80%] leading-tight drop-shadow-lg">{course.title}</h1>
          </div>
        </div>

        {/* Instructor card */}
        <div className="px-4 -mt-6 relative z-10">
          <div className="tactical-card p-4 flex items-center gap-3">
            <WatermarkedAvatar src={course.instructorPhoto} size={56} className="border-2 border-primary" alt={course.instructorName} />
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
            <div className="text-[10px] text-muted-foreground text-right max-w-[110px] leading-tight">
              <Lock className="h-3 w-3 inline mr-1 text-primary" />
              Messaging unlocks after booking
            </div>
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
          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-5 w-5 fill-primary text-primary" />
              <span className="text-2xl font-black">
                {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">· {reviews.length} review{reviews.length === 1 ? '' : 's'}</span>
            </div>
          )}
          <div className="space-y-3">
            {reviews.length === 0 ? (
              <div className="tactical-card p-4 text-center text-xs text-muted-foreground">
                No reviews yet — be the first after you attend.
              </div>
            ) : reviews.map((r) => (
              <div key={r.id} className="tactical-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  {r.studentPhoto
                    ? <img src={r.studentPhoto} className="h-8 w-8 rounded-full object-cover" alt="" />
                    : <div className="h-8 w-8 rounded-full bg-muted" />}
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
                {r.comment && <p className="text-xs text-muted-foreground leading-relaxed">{r.comment}</p>}
              </div>
            ))}
          </div>
        </Section>

        {isFull && (
          <div className="mx-4 mb-4 tactical-card border-destructive/30 bg-destructive/10 p-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-xs text-destructive font-semibold">This course is full.</span>
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
            disabled={isFull}
            className="flex-1 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold amber-glow"
          >
            {isFull ? 'Course Full' : 'Book Now'}
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
