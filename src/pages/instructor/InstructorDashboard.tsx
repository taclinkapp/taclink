import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { InstructorTabBar } from '@/components/InstructorTabBar';
import { mockCourses, mockRoster, mockReviews } from '@/lib/mockData';
import { TrendingUp, Users, DollarSign, Calendar, ChevronRight, ShieldCheck, Plus, Star, Printer, Download, ArrowLeft } from 'lucide-react';
import { NotificationsBell } from '@/components/NotificationsBell';
import { InstructorInsights } from '@/components/instructor/InstructorInsights';
import { FeeInsights } from '@/components/instructor/FeeInsights';
import { PunchCard } from '@/components/instructor/PunchCard';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

type StatKey = 'active' | 'students' | 'reviews' | 'revenue';

const InstructorDashboard = () => {
  const [open, setOpen] = useState<StatKey | null>(null);
  const [revenueDrill, setRevenueDrill] = useState<string | null>(null);
  // Pretend "this month" — derive from mocks. Marcus = i1.
  const myCourses = mockCourses; // pretend all are mine for the demo
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const breakdown = useMemo(() => {
    // Revenue per course: bookingFee × booked seats (maxStudents - spotsRemaining)
    const revenueRows = myCourses.map((c) => {
      const seats = Math.max(0, c.maxStudents - c.spotsRemaining);
      const gross = seats * c.bookingFee;
      const fee = Math.round(gross * 0.10 * 100) / 100; // 10% TacLink listing fee
      const net = gross - fee;
      return {
        id: c.id,
        title: c.title,
        seats,
        unit: c.bookingFee,
        gross,
        fee,
        total: net,
        date: c.date,
      };
    });
    const revenueTotal = revenueRows.reduce((s, r) => s + r.total, 0);
    const revenueGross = revenueRows.reduce((s, r) => s + r.gross, 0);
    const revenueFees = revenueRows.reduce((s, r) => s + r.fee, 0);

    // Students this month — group roster by their course (rotate across courses for variety)
    const studentRows = mockRoster.map((s, i) => ({
      ...s,
      course: myCourses[i % myCourses.length],
    }));

    // Active courses this month
    const activeRows = myCourses.filter((c) => c.status === 'active');

    // Reviews this month
    const reviewRows = mockReviews;
    const avgRating =
      reviewRows.reduce((s, r) => s + r.rating, 0) / Math.max(1, reviewRows.length);

    return { revenueRows, revenueTotal, revenueGross, revenueFees, studentRows, activeRows, reviewRows, avgRating };
  }, [myCourses]);

  const stats: Array<{ key: StatKey; label: string; value: string; icon: typeof Calendar; primary?: boolean; accent?: boolean }> = [
    { key: 'active', label: 'Active', value: String(breakdown.activeRows.length), icon: Calendar },
    { key: 'students', label: 'Students', value: String(breakdown.studentRows.length), icon: Users },
    { key: 'reviews', label: 'Reviews', value: String(breakdown.reviewRows.length), icon: TrendingUp, accent: true },
    { key: 'revenue', label: 'Revenue', value: `$${(breakdown.revenueTotal / 1000).toFixed(1)}K`, icon: DollarSign, primary: true },
  ];

  return (
    <MobileShell>
      <PageHeader brand right={<NotificationsBell className="-mr-2" />} />
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

        {/* Punch card + AI insights */}
        <div className="mt-4 space-y-3">
          <PunchCard />
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

      {/* Breakdown sheet */}
      <Sheet open={open !== null} onOpenChange={(v) => { if (!v) { setOpen(null); setRevenueDrill(null); } }}>
        <SheetContent side="bottom" className="bg-background border-border max-h-[85vh] overflow-y-auto">
          {open === 'revenue' && (() => {
            const drillCourse = revenueDrill ? breakdown.revenueRows.find((r) => r.id === revenueDrill) : null;
            const drillStudents = revenueDrill
              ? breakdown.studentRows.filter((s) => s.course.id === revenueDrill && s.checkedIn)
              : [];

            const handlePrint = () => window.print();
            const handleDownload = () => {
              const rows = [['Course', 'Date', 'Seats', 'Booking Fee', 'Gross', 'Listing Fee (10%)', 'Net']];
              breakdown.revenueRows.forEach((r) => {
                rows.push([r.title, new Date(r.date).toLocaleDateString(), String(r.seats), `$${r.unit}`, `$${r.gross}`, `-$${r.fee}`, `$${r.total}`]);
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
                          ? `${new Date(drillCourse.date).toLocaleDateString()} · ${drillStudents.length} attended · Net $${drillCourse.total.toLocaleString()}`
                          : `${monthLabel} · Gross $${breakdown.revenueGross.toLocaleString()} − Fees $${breakdown.revenueFees.toLocaleString()} = Net $${breakdown.revenueTotal.toLocaleString()}`}
                      </SheetDescription>
                    </div>
                    {!drillCourse && (
                      <div className="flex items-center gap-1 print:hidden">
                        <button onClick={handlePrint} className="p-2 rounded-md border border-border hover:border-primary/50 transition" aria-label="Print">
                          <Printer className="h-4 w-4" />
                        </button>
                        <button onClick={handleDownload} className="p-2 rounded-md border border-border hover:border-primary/50 transition" aria-label="Download CSV">
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </SheetHeader>

                {!drillCourse && (
                  <div className="mt-4 space-y-2">
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
                              {r.seats} × ${r.unit} · {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
                          <img src={s.photo} className="h-10 w-10 rounded-full border border-border" alt="" />
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
                    <div className="tactical-card p-3 border-primary/40 bg-primary/5">
                      <div className="flex items-center justify-between">
                        <div className="text-xs uppercase tracking-wider font-bold">Course Net</div>
                        <div className="text-lg font-black text-primary">${drillCourse.total.toLocaleString()}</div>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider">
                        <span className="text-muted-foreground">Gross <span className="text-foreground font-bold normal-case">${drillCourse.gross.toLocaleString()}</span></span>
                        <span className="text-muted-foreground">Listing fee 10% <span className="text-destructive font-bold normal-case">−${drillCourse.fee.toLocaleString()}</span></span>
                      </div>
                    </div>
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
                {breakdown.studentRows.map((s) => (
                  <div key={s.id} className="tactical-card p-3 flex items-center gap-3">
                    <img src={s.photo} className="h-10 w-10 rounded-full border border-border" alt="" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{s.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {s.course.title}
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
                {breakdown.activeRows.map((c) => {
                  const seats = c.maxStudents - c.spotsRemaining;
                  const pct = Math.round((seats / c.maxStudents) * 100);
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
                          {new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {c.city}, {c.state}
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
                  {monthLabel} · {breakdown.reviewRows.length} reviews · {breakdown.avgRating.toFixed(1)} avg
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                {breakdown.reviewRows.map((r) => (
                  <div key={r.id} className="tactical-card p-3">
                    <div className="flex items-center gap-3">
                      <img src={r.studentPhoto} className="h-9 w-9 rounded-full border border-border" alt="" />
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
