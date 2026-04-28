import { Link } from "react-router-dom";
import { MobileShell } from "@/components/MobileShell";
import { StudentTabBar } from "@/components/StudentTabBar";
import { Logo } from "@/components/Logo";
import { NotificationsBell } from "@/components/NotificationsBell";
import { TrainingGoalsSection } from "@/components/TrainingGoalsSection";
import { useMyProgress } from "@/hooks/useMyProgress";
import { Award, Calendar, MapPin, Target, TrendingUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const StatCard = ({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Award;
  value: number | string;
  label: string;
}) => (
  <div className="tactical-card p-4 flex flex-col items-center text-center">
    <Icon className="h-5 w-5 text-primary mb-2" />
    <div className="font-stencil text-3xl font-bold text-foreground">{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
  </div>
);

const MyProgress = () => {
  const { data: bookings = [], isLoading } = useMyProgress();

  const attended = bookings.filter((b) => b.status === "attended");
  const upcoming = bookings.filter(
    (b) => b.status === "reserved" && b.course?.starts_at && new Date(b.course.starts_at) > new Date(),
  );
  const disciplines = new Set(attended.map((b) => b.course?.category).filter(Boolean));

  return (
    <MobileShell>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-4 pb-3 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <Logo size="sm" />
          <h1 className="font-stencil text-xl font-bold uppercase tracking-[0.12em] text-center">
            My Progress
          </h1>
          <NotificationsBell className="h-9 w-9 rounded-full bg-card border border-border text-muted-foreground hover:text-primary" />
        </div>
      </header>

      <div className="px-4 py-4 pb-32 space-y-5">
        {/* Stats */}
        <section className="grid grid-cols-3 gap-3">
          <StatCard icon={CheckCircle2} value={attended.length} label="Attended" />
          <StatCard icon={Calendar} value={upcoming.length} label="Upcoming" />
          <StatCard icon={Target} value={disciplines.size} label="Disciplines" />
        </section>

        {/* Milestones */}
        <section className="tactical-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-stencil text-sm font-bold uppercase tracking-wider">
              Next Milestone
            </h2>
          </div>
          {(() => {
            const milestones = [1, 3, 5, 10, 25, 50];
            const next = milestones.find((m) => m > attended.length) ?? null;
            const prev = [...milestones].reverse().find((m) => m <= attended.length) ?? 0;
            const target = next ?? attended.length;
            const pct = next ? Math.round(((attended.length - prev) / (next - prev)) * 100) : 100;
            return (
              <>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    {next ? `${attended.length} / ${next} courses` : "All milestones unlocked"}
                  </span>
                  <span className="text-xs font-bold text-primary">{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </>
            );
          })()}
        </section>

        {/* Training goals */}
        <TrainingGoalsSection />

        {/* Attended list */}
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Award className="h-4 w-4 text-primary" />
            <h2 className="font-stencil text-sm font-bold uppercase tracking-wider">
              Courses Attended
            </h2>
          </div>

          {isLoading ? (
            <div className="text-center text-muted-foreground text-sm py-12">Loading…</div>
          ) : attended.length === 0 ? (
            <div className="tactical-card p-8 text-center">
              <Award className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                No completed courses yet. Book and attend a course to start tracking your progress.
              </p>
              <Link
                to="/student"
                className="btn-pill inline-flex"
              >
                Browse Courses
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {attended.map((b) => (
                <li key={b.id}>
                  <Link
                    to={b.course ? `/student/course/${b.course.id}` : "#"}
                    className="tactical-card p-3 flex gap-3 items-center hover:border-primary/40 transition"
                  >
                    <div className="h-14 w-14 rounded-md bg-surface overflow-hidden flex-shrink-0">
                      {b.course?.cover_image_url && (
                        <img
                          src={b.course.cover_image_url}
                          alt={b.course.title}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-stencil font-bold uppercase text-sm truncate">
                        {b.course?.title ?? "Course"}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        {b.course?.city && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {b.course.city}, {b.course.state}
                          </span>
                        )}
                        {b.attended_at && (
                          <span>· {new Date(b.attended_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm",
                        "bg-primary/15 text-primary border border-primary/30",
                      )}
                    >
                      Completed
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <StudentTabBar />
    </MobileShell>
  );
};

export default MyProgress;
