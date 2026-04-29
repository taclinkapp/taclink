import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { CountdownClock } from '@/components/CountdownClock';
import { GraduationCap, Shield } from 'lucide-react';
import splashBg from '@/assets/splash-bg.mp4.asset.json';

const Splash = () => {
  const nav = useNavigate();
  return (
    <div className="relative min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Ambient background video */}
      <video
        src={splashBg.url}
        autoPlay
        loop
        muted
        playsInline
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"
      />
      {/* Readability overlay */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background/70 via-background/60 to-background/90"
      />
      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-10">
        <Logo showTagline widthPx={260} />

        {/* Pre-launch badge */}
        <span className="mt-8 inline-flex items-center gap-2 px-3 py-1 rounded-full neu-sm text-[0.625rem] font-bold uppercase tracking-[0.2em] text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Pre-Launch
        </span>

        <p className="mt-4 text-center text-muted-foreground max-w-xs text-sm leading-relaxed">
          TacLink™ is in pre-launch. Sign up now to reserve your spot for launch day,
          browse the app, and help shape what's coming. Your info is collected by our
          team to get you onboarded the moment we go live.
        </p>

        <div className="mt-8 w-full">
          <CountdownClock />
        </div>
      </div>
      <div className="px-6 pt-8 pb-10 max-w-md w-full mx-auto space-y-3">
        <Button
          size="lg"
          className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base amber-glow"
          onClick={() => nav('/auth/student-signup')}
        >
          <GraduationCap className="mr-1" /> Reserve as Student
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full h-14 border-border bg-card hover:bg-muted font-bold text-base"
          onClick={() => nav('/auth/instructor-signup')}
        >
          <Shield className="mr-1" /> Reserve as Instructor
        </Button>
        <p className="text-center text-sm text-muted-foreground pt-3">
          Already have an account?{' '}
          <button onClick={() => nav('/auth/signin')} className="text-primary font-semibold hover:underline">
            Sign In
          </button>
        </p>
      </div>
      </div>
    </div>
  );
};

export default Splash;
