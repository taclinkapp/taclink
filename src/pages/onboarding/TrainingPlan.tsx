import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PILLARS, type PillarId } from "@/lib/pillars";
import { loadQuizLocal } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { CourseCard } from "@/components/CourseCard";
import { dbToViewCourse, type DbCourse } from "@/lib/courses";
import { useAreaCourseAnalytics } from "@/hooks/useAreaCourseAnalytics";
import { MapPin, Clock, DollarSign, Users, ArrowLeft } from "lucide-react";

const TrainingPlan = () => {
  const nav = useNavigate();
  const answers = useMemo(() => loadQuizLocal(), []);
  const selected = new Set<PillarId>(answers.selected_pillars);
  const radius = answers.travel_radius_miles && answers.travel_radius_miles > 0
    ? answers.travel_radius_miles
    : 50;
  const [previewCourses, setPreviewCourses] = useState<any[]>([]);

  const analytics = useAreaCourseAnalytics({
    pillars: answers.selected_pillars,
    radiusMiles: radius,
  });

  useEffect(() => {
    (async () => {
      let q = supabase.from("courses").select("*").eq("status", "published");
      if (answers.selected_pillars.length) {
        q = q.in("primary_pillar", answers.selected_pillars as any);
      }
      const { data } = await q.limit(3);
      const rows = (data as DbCourse[]) ?? [];
      setPreviewCourses(rows.map((r) => dbToViewCourse(r)));
    })();
  }, [answers.selected_pillars]);

  const fmtMiles = (m: number | null) =>
    m == null ? "—" : m < 1 ? `${(m * 5280).toFixed(0)} ft` : `${m.toFixed(1)} mi`;
  const fmtPrice = (c: number | null) =>
    c == null ? "—" : `$${Math.round(c / 100)}`;
  const fmtSoonest = (s: string | null) => {
    if (!s) return "—";
    const days = Math.max(0, Math.round((new Date(s).getTime() - Date.now()) / 86_400_000));
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days < 7) return `In ${days} days`;
    if (days < 30) return `In ${Math.round(days / 7)} wk`;
    return `In ${Math.round(days / 30)} mo`;
  };


  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="max-w-md mx-auto px-6 pt-6">
        <button
          onClick={() => nav("/welcome/quiz")}
          aria-label="Back"
          className="inline-flex items-center justify-center h-11 w-11 -ml-2 mb-2 rounded-full text-foreground hover:bg-foreground/10 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="inline-block text-[0.625rem] font-bold uppercase tracking-[0.25em] text-primary">
          Training Plan
        </span>
        <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight">
          Your Training Plan Is Ready
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Built around the pillars you picked. You can change these any time from your Operator Profile.
        </p>

        {/* Pillars grid */}
        <div className="mt-6 grid grid-cols-3 gap-2">
          {PILLARS.map((p) => {
            const on = selected.has(p.id);
            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-xl border-2 p-3 text-center transition-all",
                  on
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card opacity-40"
                )}
              >
                <div className="text-2xl">{p.emoji}</div>
                <div className="mt-1 text-[0.65rem] font-bold uppercase tracking-wider text-foreground">
                  {p.name}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live area analytics */}
        <div className="mt-6 neu p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Courses matching your plan
            </div>
            <div className="text-[0.6rem] font-semibold text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {analytics.located ? `${radius} mi radius` : "Nationwide"}
            </div>
          </div>
          <div className="mt-1 text-3xl font-black text-primary">
            {analytics.loading ? "—" : analytics.matchingPillars}
            <span className="text-base text-muted-foreground font-bold ml-2">
              {analytics.located ? "near you" : "available"}
            </span>
          </div>
          {!analytics.loading && analytics.totalInArea > analytics.matchingPillars && (
            <div className="mt-1 text-xs text-muted-foreground">
              of {analytics.totalInArea} total in your area
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/40 p-2.5">
              <div className="flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
                <MapPin className="h-3 w-3" /> Nearest
              </div>
              <div className="mt-0.5 text-sm font-bold text-foreground">
                {fmtMiles(analytics.nearestMiles)}
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2.5">
              <div className="flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3 w-3" /> Next class
              </div>
              <div className="mt-0.5 text-sm font-bold text-foreground">
                {fmtSoonest(analytics.soonestStartAt)}
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2.5">
              <div className="flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
                <DollarSign className="h-3 w-3" /> Avg price
              </div>
              <div className="mt-0.5 text-sm font-bold text-foreground">
                {fmtPrice(analytics.avgPriceCents)}
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2.5">
              <div className="flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
                <Users className="h-3 w-3" /> Instructors
              </div>
              <div className="mt-0.5 text-sm font-bold text-foreground">
                {analytics.instructorsInArea}
              </div>
            </div>
          </div>

          {analytics.topCity && (
            <div className="mt-3 text-xs text-muted-foreground">
              Most active hub:{" "}
              <span className="font-semibold text-foreground">
                {analytics.topCity.city}
              </span>{" "}
              ({analytics.topCity.count} courses)
            </div>
          )}
          {analytics.locationError && (
            <div className="mt-2 text-[0.65rem] text-muted-foreground italic">
              {analytics.locationError}
            </div>
          )}
        </div>

        {/* Preview courses */}
        {previewCourses.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              A taste of what's available
            </div>
            {previewCourses.map((c) => (
              <div key={c.id} className="pointer-events-none opacity-95">
                <CourseCard course={c as any} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 px-6 pb-8 pt-4 bg-gradient-to-t from-background via-background to-transparent">
        <div className="max-w-md mx-auto space-y-3">
          <Button
            size="lg"
            className="w-full h-14 font-bold text-base"
            onClick={() => nav("/auth/student-signup?from=onboarding")}
          >
            Create Your Account to Book
          </Button>
          <button
            onClick={() => nav("/student?guest=1")}
            className="w-full h-10 text-sm font-semibold text-muted-foreground hover:text-foreground story-link"
          >
            Explore Without an Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrainingPlan;
