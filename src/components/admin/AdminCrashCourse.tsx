import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GraduationCap, ChevronLeft, ChevronRight, X, CheckCircle2, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CRASH_COURSES,
  resolveCrashCourse,
  type CrashCourse,
  type CrashStep,
} from './adminCrashCourseContent';

const LS_KEY = 'admin-crash-course-seen-v1';

function getSeen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
}

function markSeen(id: string) {
  const seen = getSeen();
  seen[id] = true;
  localStorage.setItem(LS_KEY, JSON.stringify(seen));
}

/**
 * Per-tab onboarding walkthrough for the admin panel.
 *
 *  - Auto-opens the first time an admin lands on a tab.
 *  - Can be dismissed (Skip) — saved to localStorage.
 *  - Always re-openable from the floating "Crash Course" button on the same tab.
 */
export const AdminCrashCourse = () => {
  const { pathname } = useLocation();
  const course = useMemo<CrashCourse | null>(() => resolveCrashCourse(pathname), [pathname]);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Auto-open every time the admin lands on a tab (persistent crash course)
  useEffect(() => {
    if (!course) return;
    setStep(0);
    // small delay so it doesn't fight with route transitions
    const t = setTimeout(() => setOpen(true), 250);
    return () => clearTimeout(t);
  }, [course?.id]);

  if (!course) return null;

  const total = course.steps.length;
  const current: CrashStep | undefined = course.steps[step];
  const isLast = step >= total - 1;
  if (!current) return null;

  const close = (markComplete: boolean) => {
    if (markComplete) markSeen(course.id);
    setOpen(false);
  };

  return (
    <>
      {/* Floating launcher — always available so admins can re-open the tour for the current tab */}
      <button
        type="button"
        onClick={() => {
          setStep(0);
          setOpen(true);
        }}
        aria-label={`Open crash course for ${course.title}`}
        className={cn(
          'fixed z-40 bottom-4 left-4 h-11 pl-3 pr-4 rounded-full',
          'bg-card border border-primary/40 shadow-lg flex items-center gap-2',
          'text-xs font-bold uppercase tracking-wider text-primary',
          'hover:bg-primary hover:text-primary-foreground transition-colors',
        )}
      >
        <GraduationCap className="h-4 w-4" />
        Crash Course
      </button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close(true))}>
        <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary/15 via-card to-card border-b border-border px-5 py-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold text-primary">
              <GraduationCap className="h-3.5 w-3.5" />
              Admin Crash Course
              <span className="ml-auto text-muted-foreground tracking-normal normal-case font-semibold">
                {step + 1} / {total}
              </span>
            </div>
            <DialogHeader className="space-y-1 mt-2">
              <DialogTitle className="text-lg font-extrabold leading-tight">
                {course.title}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {course.subtitle}
              </DialogDescription>
            </DialogHeader>
            {/* Progress bar */}
            <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${((step + 1) / total) * 100}%` }}
              />
            </div>
          </div>

          {/* Step body */}
          <div className="px-5 py-5 space-y-4 max-h-[55vh] overflow-y-auto">
            <div>
              <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                Step {step + 1} — {current.heading}
              </div>
              <p className="text-sm leading-relaxed text-foreground">{current.body}</p>
            </div>

            {current.bullets && current.bullets.length > 0 && (
              <ul className="space-y-2">
                {current.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">{b.label}</strong>
                      {b.text ? ` — ${b.text}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {current.tip && (
              <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed text-foreground">
                  <span className="font-bold uppercase tracking-wider text-primary mr-1">Pro tip:</span>
                  {current.tip}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="px-5 py-3 border-t border-border bg-card flex sm:flex-row gap-2 sm:justify-between">
            <button
              type="button"
              onClick={() => close(true)}
              className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Skip
            </button>
            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                disabled={step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              {isLast ? (
                <Button size="sm" onClick={() => close(true)}>
                  Got it
                  <CheckCircle2 className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button size="sm" onClick={() => setStep((s) => Math.min(total - 1, s + 1))}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export { CRASH_COURSES };
export default AdminCrashCourse;
