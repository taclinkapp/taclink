import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PILLARS, type PillarId } from "@/lib/pillars";
import quizStep1Bg from "@/assets/quiz-step1-bg.mp4";
import quizStep2Bg from "@/assets/quiz-step2-bg.mp4";
import quizStep3Bg from "@/assets/quiz-step3-bg.mp4";
import {
  loadQuizLocal,
  saveQuizLocal,
  type ExperienceLevel,
  type TrainingGoal,
  type QuizAnswers,
  EMPTY_QUIZ,
} from "@/lib/onboarding";

const TOTAL_STEPS = 4;

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; emoji: string; label: string }[] = [
  { value: "new",         emoji: "🔰", label: "New to tactical training" },
  { value: "civilian",    emoji: "🎯", label: "Some civilian training" },
  { value: "mil_le",      emoji: "🪖", label: "Military or Law Enforcement" },
  { value: "instructor",  emoji: "🏫", label: "I'm a trainer / instructor" },
];

const GOAL_OPTIONS: { value: TrainingGoal; emoji: string; label: string }[] = [
  { value: "self_defense", emoji: "🛡️", label: "Personal protection & self-defense" },
  { value: "competition",  emoji: "🏆", label: "Competition & sport shooting" },
  { value: "career",       emoji: "💼", label: "Career advancement (security, LE, military)" },
  { value: "stay_sharp",   emoji: "⚔️", label: "Stay sharp & keep skills current" },
];

const RADIUS_OPTIONS = [
  { value: 10,  label: "Within 10 miles" },
  { value: 25,  label: "Within 25 miles" },
  { value: 50,  label: "Within 50 miles" },
  { value: 100, label: "Within 100 miles" },
  { value: 0,   label: "Any distance" },
];

const Quiz = () => {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [answers, setAnswers] = useState<QuizAnswers>(EMPTY_QUIZ);
  const [building, setBuilding] = useState(false);

  useEffect(() => { setAnswers(loadQuizLocal()); }, []);

  const update = (patch: Partial<QuizAnswers>) => {
    const next = { ...answers, ...patch };
    setAnswers(next);
    saveQuizLocal(patch);
  };

  const next = () => {
    setDirection("forward");
    if (step < TOTAL_STEPS) setStep(step + 1);
    else finish();
  };
  const back = () => {
    setDirection("back");
    if (step > 1) setStep(step - 1);
    else nav("/welcome");
  };

  const finish = () => {
    setBuilding(true);
    setTimeout(() => nav("/welcome/plan"), 1500);
  };

  const togglePillar = (id: PillarId) => {
    const has = answers.selected_pillars.includes(id);
    let nextPillars = has
      ? answers.selected_pillars.filter((p) => p !== id)
      : [...answers.selected_pillars, id];
    if (nextPillars.length > 3) nextPillars = nextPillars.slice(0, 3);
    update({ selected_pillars: nextPillars });
  };

  const canProceed =
    (step === 1 && !!answers.experience_level) ||
    (step === 2 && !!answers.training_goal) ||
    (step === 3 && answers.selected_pillars.length > 0) ||
    (step === 4 && answers.travel_radius_miles !== null);

  if (building) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="h-16 w-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-primary">
          Building your training plan…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {(step === 1 || step === 2) && (
        <>
          <video
            key={step}
            src={step === 1 ? quizStep1Bg : quizStep2Bg}
            autoPlay loop muted playsInline aria-hidden
            className="fixed inset-0 w-full h-full object-cover opacity-40 pointer-events-none z-0"
          />
          <div aria-hidden className="fixed inset-0 bg-gradient-to-b from-background/60 via-background/70 to-background pointer-events-none z-0" />
        </>
      )}
      <div className="relative z-10 flex flex-col flex-1">
      {/* Progress bar */}
      <div className="h-1 w-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      <header className="px-4 py-3 flex items-center gap-3">
        <button onClick={back} className="p-2 -ml-2 rounded-md hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Step {step} of {TOTAL_STEPS}
        </span>
      </header>

      <div
        key={step}
        className={cn(
          "flex-1 px-6 pb-32 max-w-md w-full mx-auto",
          direction === "forward" ? "animate-slide-in-right" : "animate-fade-in"
        )}
      >
        {step === 1 && (
          <Step
            title="What's your training background?"
            options={EXPERIENCE_OPTIONS.map((o) => ({
              key: o.value,
              selected: answers.experience_level === o.value,
              onClick: () => update({ experience_level: o.value }),
              content: <OptionRow emoji={o.emoji} label={o.label} />,
            }))}
          />
        )}

        {step === 2 && (
          <Step
            title="What are you training for?"
            options={GOAL_OPTIONS.map((o) => ({
              key: o.value,
              selected: answers.training_goal === o.value,
              onClick: () => update({ training_goal: o.value }),
              content: <OptionRow emoji={o.emoji} label={o.label} />,
            }))}
          />
        )}

        {step === 3 && (
          <Step
            title="Which skills do you want to build?"
            subtitle="Pick up to 3 — we'll personalize your feed."
            options={PILLARS.map((p) => ({
              key: p.id,
              selected: answers.selected_pillars.includes(p.id),
              onClick: () => togglePillar(p.id),
              content: <OptionRow emoji={p.emoji} label={p.name} sub={p.blurb} />,
            }))}
          />
        )}

        {step === 4 && (
          <Step
            title="How far will you travel for training?"
            options={RADIUS_OPTIONS.map((o) => ({
              key: String(o.value),
              selected: answers.travel_radius_miles === o.value,
              onClick: () => update({ travel_radius_miles: o.value }),
              content: <OptionRow label={o.label} />,
            }))}
          />
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 px-6 pb-8 pt-4 bg-gradient-to-t from-background via-background to-transparent">
        <div className="max-w-md mx-auto">
          <Button
            size="lg"
            disabled={!canProceed}
            onClick={next}
            className="w-full h-14 font-bold text-base"
          >
            {step === TOTAL_STEPS ? "Build My Plan" : "Continue"}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
};

type OptionDef = {
  key: string;
  selected: boolean;
  onClick: () => void;
  content: React.ReactNode;
};

const Step = ({
  title, subtitle, options,
}: { title: string; subtitle?: string; options: OptionDef[] }) => (
  <div className="pt-4">
    <h1 className="text-2xl font-black leading-tight tracking-tight">{title}</h1>
    {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
    <div className="mt-6 space-y-3">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={o.onClick}
          className={cn(
            "w-full text-left p-4 rounded-xl border-2 transition-all min-h-[64px] flex items-center justify-between gap-3",
            o.selected
              ? "border-primary bg-primary/10"
              : "border-border bg-card hover:border-muted-foreground/40"
          )}
        >
          <div className="flex-1">{o.content}</div>
          {o.selected && (
            <div className="shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground grid place-items-center">
              <Check className="h-4 w-4" />
            </div>
          )}
        </button>
      ))}
    </div>
  </div>
);

const OptionRow = ({ emoji, label, sub }: { emoji?: string; label: string; sub?: string }) => (
  <div className="flex items-center gap-3">
    {emoji && <span className="text-2xl shrink-0">{emoji}</span>}
    <div className="min-w-0">
      <div className="font-bold text-base text-foreground">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{sub}</div>}
    </div>
  </div>
);

export default Quiz;
