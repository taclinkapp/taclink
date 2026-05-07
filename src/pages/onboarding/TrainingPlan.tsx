import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PILLARS, type PillarId } from "@/lib/pillars";
import { loadQuizLocal } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { CourseCard } from "@/components/CourseCard";
import { dbToViewCourse, type DbCourse } from "@/lib/courses";

const TrainingPlan = () => {
  const nav = useNavigate();
  const answers = useMemo(() => loadQuizLocal(), []);
  const selected = new Set<PillarId>(answers.selected_pillars);
  const [previewCourses, setPreviewCourses] = useState<any[]>([]);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      let q = supabase.from("courses").select("*", { count: "exact" }).eq("status", "published");
      if (answers.selected_pillars.length) {
        q = q.in("primary_pillar", answers.selected_pillars as any);
      }
      const { data, count: c } = await q.limit(3);
      const rows = (data as DbCourse[]) ?? [];
      setPreviewCourses(rows.map((r) => dbToViewCourse(r)));
      setCount(c ?? rows.length);
    })();
  }, [answers.selected_pillars]);

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="max-w-md mx-auto px-6 pt-12">
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

        {/* Stat */}
        <div className="mt-6 neu p-4 rounded-xl">
          <div className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Courses matching your plan
          </div>
          <div className="mt-1 text-3xl font-black text-primary">
            {count ?? "—"}<span className="text-base text-muted-foreground font-bold ml-2">near you</span>
          </div>
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
