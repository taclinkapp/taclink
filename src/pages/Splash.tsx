import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { GraduationCap, Shield } from 'lucide-react';

const Splash = () => {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <Logo size="xl" showTagline />
        <p className="mt-12 text-center text-muted-foreground max-w-xs text-sm leading-relaxed">
          The marketplace for verified tactical, firearms, and self-defense training.
        </p>
      </div>
      <div className="px-6 pb-10 max-w-md w-full mx-auto space-y-3">
        <Button
          size="lg"
          className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base amber-glow"
          onClick={() => nav('/auth/student-signup')}
        >
          <GraduationCap className="mr-1" /> I'm a Student
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full h-14 border-border bg-card hover:bg-muted font-bold text-base"
          onClick={() => nav('/auth/instructor-signup')}
        >
          <Shield className="mr-1" /> I'm an Instructor
        </Button>
        <p className="text-center text-sm text-muted-foreground pt-3">
          Already have an account?{' '}
          <button onClick={() => nav('/auth/signin')} className="text-primary font-semibold hover:underline">
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
};

export default Splash;
