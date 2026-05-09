import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { InstructorTabBar } from '@/components/InstructorTabBar';
import { useInstructorCourses } from '@/hooks/useCourses';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Users, DollarSign, Calendar, ChevronRight, ShieldCheck, Plus, Star, Printer, Download, ArrowLeft } from 'lucide-react';
import { NotificationsBell } from '@/components/NotificationsBell';
import { WarriorQuoteBackdrop } from '@/components/WarriorQuoteBackdrop';
import { InstructorInsights } from '@/components/instructor/InstructorInsights';
import { FeeInsights } from '@/components/instructor/FeeInsights';
import { AutoRefundDisputes } from '@/components/instructor/AutoRefundDisputes';
import { LapsedSubscriptionBanner } from '@/components/instructor/LapsedSubscriptionBanner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { CrashCourseTour, useCrashCourseTour } from '@/components/CrashCourseTour';
import { FounderBioModal } from '@/components/FounderBioModal';
import { getAvatarSrc } from '@/lib/avatar';

type StatKey = 'active' | 'students' | 'reviews' | 'revenue';

const InstructorDashboard = () => {
  const { user, profile } = useAuth();
  const tour = useCrashCourseTour('instructor', user?.id);
  const [open, setOpen] = useState<StatKey | null>(null);
  const [revenueDrill, setRevenueDrill] = useState<string | null>(null);
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const { data: myCourses = [] } = useInstructorCourses(user?.id);

  // This-month bookings across all instructor courses (single round-trip).
  const courseIds = myCourses.map((c) => c.id);
  const { data: monthBookings = [] } = useQuery({
    queryKey: ['instructor_month_bookings', user?.id, courseIds.join(',')],
    enabled: !!user?.id && courseIds.length > 0,
    queryFn: async () => {
      const start = new Date();
      start.setDate(1); start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('bookings')
        .select('id, course_id, status, attended_at, booked_at, student_id, profiles:student_id(display_name, photo_url)')
        .in('course_id', courseIds)
        .gte('booked_at', start.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  // This-month reviews on instructor's courses.
  const { data: monthReviews = [] } = useQuery({
    queryKey: ['instructor_month_reviews', user?.id, courseIds.join(',')],
    enabled: !!user?.id && courseIds.length > 0,
    queryFn: async () => {
      const start = new Date();
      start.setDate(1); start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, student_id, course_id, profiles:student_id(display_name, photo_url)')
        .in('course_id', courseIds)
        .gte('created_at', start.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const breakdown = useMemo(() => {
    const revenueRows = myCourses.map((c) => {
      const seats = monthBookings.filter((b: any) => b.course_id === c.id && b.status === 'attended').length;
      const gross = seats * c.bookingFee;
      const fee = Math.round(gross * 0.10 * 100) / 100;
      const net = gross - fee;
      return { id: c.id, title: c.title, seats, unit: c.bookingFee, gross, fee, total: net, date: c.date };
    });
    const revenueTotal = revenueRows.reduce((s, r) => s + r.total, 0);
    const revenueGross = revenueRows.reduce((s, r) => s + r.gross, 0);
    const revenueFees = revenueRows.reduce((s, r) => s + r.fee, 0);

    const studentRows = monthBookings.map((b: any) => ({
      id: b.id,
      name: b.profiles?.display_name ?? 'Student',
      photo: b.profiles?.photo_url ?? '',
      bookedAt: b.booked_at,
      paymentStatus: b.status === 'cancelled' ? 'refunded' : 'paid',
      checkedIn: !!b.attended_at,
      course: myCourses.find((c) => c.id === b.course_id) ?? myCourses[0],
    })).filter((s) => s.course);

    const activeRows = myCourses.filter((c) => c.status === 'active');

    const reviewRows = monthReviews.map((r: any) => ({
      id: r.id,
      studentName: r.profiles?.display_name ?? 'Student',
      studentPhoto: r.profiles?.photo_url ?? '',
      rating: r.rating,
      comment: r.comment,
      date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
    const avgRating = reviewRows.reduce((s, r) => s + r.rating, 0) / Math.max(1, reviewRows.length);

    return { revenueRows, revenueTotal, revenueGross, revenueFees, studentRows, activeRows, reviewRows, avgRating };
  }, [myCourses, monthBookings, monthReviews]);

  const stats: Array<{ key: StatKey; label: string; value: string; icon: typeof Calendar; primary?: boolean; accent?: boolean }> = [
    { key: 'active', label: 'Active', value: String(breakdown.activeRows.length), icon: Calendar },
    { key: 'students', label: 'Students', value: String(breakdown.studentRows.length), icon: Users },
    { key: 'reviews', label: 'Reviews', value: String(breakdown.reviewRows.length), icon: TrendingUp, accent: true },
    { key: 'revenue', label: 'Revenue', value: `$${(breakdown.revenueTotal / 1000).toFixed(1)}K`, icon: DollarSign, primary: true },
  ];

  const upcoming = myCourses
    .filter((c) => c.status === 'active' && c.date && new Date(c.date).getTime() >= Date.now() - 86_400_000)
    .slice(0, 3);

  const recent = breakdown.studentRows
    .slice()
    .sort((a, b) => new Date(b.bookedAt).getTime() - new Date(a.bookedAt).getTime())
    .slice(0, 4);

  const displayName = profile?.display_name ?? 'Instructor';
  const avatarSrc = getAvatarSrc(profile?.photo_url, displayName);

  return (
    <MobileShell>
      <WarriorQuoteBackdrop audience="instructor" />
      <PageHeader brand right={<NotificationsBell className="-mr-2" />} />
      <div className="px-4 pt-2">
        <div className="flex items-center gap-3">
          <img src={avatarSrc} className="h-12 w-12 rounded-full border-2 border-primary object-cover" alt="" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Welcome back,</p>
            <h1 className="text-xl font-black truncate">{displayName}</h1>
          </div>
          <Link
            to="/instructor/courses/new"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition"
          >
            <Plus className="h-4 w-4" /> New Course
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-5">
          {stats.map((s) => (
            <button
              key={s.key}
              onClick={() => setOpen(s.key)}
              className="tactical-card p-4 text-left hover:border-primary/50 active:scale-[0.99] transition group"
            >
              <div className="flex items-center justify-between mb-2">
                <s.icon className={`h-4 w-4 ${s.primary ? 'text-primary' : 'text-muted-foreground'}`} />
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary transition" />
              </div>
              <div className={`text-2xl font-black ${s.primary ? 'text-primary' : 'text-foreground'}`}>{s.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{s.label} this month</div>
            </button>
          ))}
        </div>

        <AutoRefundDisputes />
        <LapsedSubscriptionBanner />

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

        <div className="mt-4 space-y-3">
          <FeeInsights />
          <InstructorInsights />
        </div>

        <Section title="Upcoming Courses">
          {upcoming.length === 0 ? (
            <div className="tactical-card p-4 text-center text-xs text-muted-foreground">
              No upcoming courses. <Link to="/instructor/courses/new" className="text-primary font-bold">Create one →</Link>
            </div>
          ) : (
            upcoming.map((c) => {
              const seats = monthBookings.filter((b: any) => b.course_id === c.id && b.status !== 'cancelled').length;
              return (
                <Link key={c.id} to={`/instructor/courses/${c.id}`} className="tactical-card p-3 flex items-center gap-3 hover:border-primary/40">
                  <div className="h-12 w-1 rounded-sm bg-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{c.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {c.date ? new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'} · {seats}/{c.maxStudents} students
                    </div>
                  </div>
                  <div className="text-xs font-bold uppercase text-primary">Manage</div>
                </Link>
              );
            })
          )}
        </Section>

        <Section title="Recent Activity">
          {recent.length === 0 ? (
            <div className="tactical-card p-4 text-center text-xs text-muted-foreground">No recent activity yet.</div>
          ) : (
            recent.map((s) => (
              <div key={s.id} className="tactical-card p-3 flex items-center gap-3">
                <img src={getAvatarSrc(s.photo, s.name)} className="h-9 w-9 rounded-full border border-border object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm"><span className="font-semibold">{s.name}</span> <span className="text-muted-foreground">{s.checkedIn ? 'checked in' : 'booked a course'}</span></div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(s.bookedAt).toLocaleDateString()}</div>
                </div>
              </div>
            ))
          )}
        </Section>
      </div>
      <InstructorTabBar />

      <Sheet open={open !== null} onOpenChange={(v) => { if (!v) { setOpen(null); setRevenueDrill(null); } }}>
        <SheetContent side="bottom" className="bg-background border-border max-h-[85vh] overflow-y-auto">
          {open === 'revenue' && (() => {
            const drillCourse = revenueDrill ? breakdown.revenueRows.find((r) => r.id === revenueDrill) : null;
            const drillStudents = revenueDrill
              ? breakdown.studentRows.filter((s) => s.course?.id === revenueDrill && s.checkedIn)
              : [];

            const handlePrint = () => window.print();
            const handleDownload = () => {
              const rows = [['Course', 'Date', 'Seats', 'Booking Fee', 'Gross', 'Listing Fee (10%)', 'Net']];
              breakdown.revenueRows.forEach((r) => {
                rows.push([r.title, r.date ? new Date(r.date).toLocaleDateString() : '', String(r.seats), `$${r.unit}`, `$${r.gross}`, `-$${r.fee}`, `$${r.total}`]);
              });
              rows.push(['', '', '', '', `$${breakdown.revenueGross}`, `-$${breakdown.revenueFees}`, `$${breakdown.revenueTotal}`]);
              const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `revenue-${monthLabel.replace(/\s/g, '-').toLowerCase()}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            };

            return (
              <>
                <SheetHeader className="text-left print:block">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <SheetTitle className="text-lg font-black flex items-center gap-2">
                        {drillCourse ? (
                          <>
                            <button onClick={() => setRevenueDrill(null)} className="p-1 -ml-1 rounded hover:bg-muted print:hidden" aria-label="Back">
                              <ArrowLeft className="h-4 w-4" />
                            </button>
                            <DollarSign className="h-5 w-5 text-primary" /> {drillCourse.title}
                          </>
                        ) : (
                          <><DollarSign className="h-5 w-5 text-primary" /> Revenue Breakdown</>
                        )}
                      </SheetTitle>
                      <SheetDescription className="text-xs">
                        {drillCourse
                          ? `${drillCourse.date ? new Date(drillCourse.date).toLocaleDateString() : ''} · ${drillStudents.length} attended · Net $${drillCourse.total.toLocaleString()}`
                          : `${monthLabel} · Gross $${breakdown.revenueGross.toLocaleString()} − Fees $${breakdown.revenueFees.toLocaleString()} = Net $${breakdown.revenueTotal.toLocaleString()}`}
                      </SheetDescription>
                    </div>
                    {!drillCourse && (
                      <div className="flex items-center gap-1 print:hidden mr-8">
                        <button onClick={handleDownload} className="p-2 rounded-md border border-border hover:border-primary/50 transition" aria-label="Download CSV">
                          <Download className="h-4 w-4" />
                        </button>
                        <button onClick={handlePrint} className="p-2 rounded-md border border-border hover:border-primary/50 transition" aria-label="Print">
                          <Printer className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </SheetHeader>

                {!drillCourse && (
                  <div className="mt-4 space-y-2">
                    {breakdown.revenueRows.length === 0 && (
                      <div className="tactical-card p-6 text-center text-xs text-muted-foreground">No revenue this month yet.</div>
                    )}
                    {breakdown.revenueRows.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setRevenueDrill(r.id)}
                        className="tactical-card p-3 w-full text-left hover:border-primary/40 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{r.title}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {r.seats} × ${r.unit}{r.date ? ` · ${new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-black text-primary">${r.total.toLocaleString()}</div>
                            <div className="text-[10px] text-muted-foreground">net</div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wider border-t border-border/60 pt-2">
                          <span className="text-muted-foreground">Gross <span className="text-foreground font-bold normal-case">${r.gross.toLocaleString()}</span></span>
                          <span className="text-muted-foreground">Listing fee 10% <span className="text-destructive font-bold normal-case">−${r.fee.toLocaleString()}</span></span>
                        </div>
                      </button>
                    ))}
                    {breakdown.revenueRows.length > 0 && (
                      <div className="tactical-card p-3 border-primary/40 bg-primary/5">
                        <div className="flex items-center justify-between">
                          <div className="text-xs uppercase tracking-wider font-bold">Net Total</div>
                          <div className="text-lg font-black text-primary">${breakdown.revenueTotal.toLocaleString()}</div>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider">
                          <span className="text-muted-foreground">Gross <span className="text-foreground font-bold normal-case">${breakdown.revenueGross.toLocaleString()}</span></span>
                          <span className="text-muted-foreground">Listing fees <span className="text-destructive font-bold normal-case">−${breakdown.revenueFees.toLocaleString()}</span></span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {drillCourse && (
                  <div className="mt-4 space-y-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">
                      Attended students ({drillStudents.length})
                    </div>
                    {drillStudents.length === 0 && (
                      <div className="tactical-card p-4 text-center text-xs text-muted-foreground">
                        No students have checked in for this course yet.
                      </div>
                    )}
                    {drillStudents.map((s) => {
                      const perNet = Math.round(drillCourse.unit * 0.9 * 100) / 100;
                      return (
                        <div key={s.id} className="tactical-card p-3 flex items-center gap-3">
                          <img src={getAvatarSrc(s.photo, s.name)} className="h-10 w-10 rounded-full border border-border object-cover" alt="" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{s.name}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Checked in · Booked {new Date(s.bookedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {s.paymentStatus}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black text-primary">${perNet.toLocaleString()}</div>
                            <div className="text-[10px] text-muted-foreground">${drillCourse.unit} − 10%</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}

          {open === 'students' && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="text-lg font-black flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Students This Month
                </SheetTitle>
                <SheetDescription className="text-xs">{monthLabel} · {breakdown.studentRows.length} students</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                {breakdown.studentRows.length === 0 && (
                  <div className="tactical-card p-6 text-center text-xs text-muted-foreground">No bookings this month.</div>
                )}
                {breakdown.studentRows.map((s) => (
                  <div key={s.id} className="tactical-card p-3 flex items-center gap-3">
                    <img src={getAvatarSrc(s.photo, s.name)} className="h-10 w-10 rounded-full border border-border object-cover" alt="" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{s.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {s.course?.title}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${s.paymentStatus === 'paid' ? 'text-primary' : 'text-muted-foreground'}`}>
                        {s.paymentStatus}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(s.bookedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {open === 'active' && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="text-lg font-black flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" /> Active Courses
                </SheetTitle>
                <SheetDescription className="text-xs">{monthLabel} · {breakdown.activeRows.length} active</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                {breakdown.activeRows.length === 0 && (
                  <div className="tactical-card p-6 text-center text-xs text-muted-foreground">No active courses.</div>
                )}
                {breakdown.activeRows.map((c) => {
                  const seats = monthBookings.filter((b: any) => b.course_id === c.id && b.status !== 'cancelled').length;
                  const pct = c.maxStudents ? Math.round((seats / c.maxStudents) * 100) : 0;
                  return (
                    <Link
                      key={c.id}
                      to={`/instructor/courses/${c.id}`}
                      onClick={() => setOpen(null)}
                      className="tactical-card p-3 flex items-center gap-3 hover:border-primary/40"
                    >
                      <div className="h-12 w-1 rounded-sm bg-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{c.title}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {c.date ? new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'} · {c.city}, {c.state}
                        </div>
                        <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black">{seats}/{c.maxStudents}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">filled</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {open === 'reviews' && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="text-lg font-black flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary fill-primary" /> Reviews This Month
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {monthLabel} · {breakdown.reviewRows.length} reviews · {breakdown.reviewRows.length ? breakdown.avgRating.toFixed(1) : '—'} avg
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                {breakdown.reviewRows.length === 0 && (
                  <div className="tactical-card p-6 text-center text-xs text-muted-foreground">No reviews this month yet.</div>
                )}
                {breakdown.reviewRows.map((r) => (
                  <div key={r.id} className="tactical-card p-3">
                    <div className="flex items-center gap-3">
                      {r.studentPhoto
                        ? <img src={r.studentPhoto} className="h-9 w-9 rounded-full border border-border object-cover" alt="" />
                        : <div className="h-9 w-9 rounded-full bg-muted border border-border" />}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{r.studentName}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3 w-3 ${i < r.rating ? 'text-primary fill-primary' : 'text-muted-foreground/30'}`} />
                          ))}
                          <span className="text-[10px] text-muted-foreground ml-1">{r.date}</span>
                        </div>
                      </div>
                    </div>
                    {r.comment && (
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">"{r.comment}"</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <CrashCourseTour role="instructor" open={tour.open} onClose={tour.close} />
      <FounderBioModal userId={user?.id} />
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
