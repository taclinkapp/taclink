import { Navigate, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { CountdownClock } from '@/components/CountdownClock';
import { GraduationCap, Loader2, Shield } from 'lucide-react';
import { homeForRole, useAuth } from '@/contexts/AuthContext';
import splashBg from '@/assets/splash-bg.mp4.asset.json';

const Splash = () => {
  const nav = useNavigate();
  const { user, primaryRole, loading } = useAuth();

  if (loading || (user && !primaryRole)) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (user && primaryRole) {
    return <Navigate to={homeForRole(primaryRole)} replace />;
  }

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
          The first marketplace built exclusively for tactical, firearms, and combatives training — connecting serious students with vetted instructors. No one else is doing this for our community.
          <span className="block mt-3 text-[0.7rem] text-muted-foreground/80 italic leading-relaxed">
            We're a web app by design. As a Second Amendment–aligned platform, mainstream app store policies place heavy restrictions on firearms-related services — staying on the open web keeps us accessible to every lawful instructor and student, no gatekeepers. Add to your home screen for an app-like experience.
          </span>
          <span className="block mt-2 text-foreground/80 font-semibold">
            Reserve your spot now. Booking and payments unlock on launch day.
          </span>
        </p>

        <div className="mt-8 w-full">
          <CountdownClock />
        </div>
      </div>
      <div className="px-6 pt-8 pb-10 max-w-md w-full mx-auto space-y-3">
        <Button
          size="lg"
          className="w-full h-14 bg-[#B22234] text-white hover:bg-[#9a1d2c] font-bold text-base"
          onClick={() => nav('/auth/instructor-signup')}
        >
          <Shield className="mr-1" /> Reserve as Instructor
        </Button>
        <Button
          size="lg"
          className="w-full h-14 bg-[#3C3B6E] text-white hover:bg-[#2f2e57] font-bold text-base"
          onClick={() => nav('/welcome')}
        >
          <GraduationCap className="mr-1" /> Students
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
