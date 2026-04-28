import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/MobileShell';

const SignIn = () => {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <PageHeader back />
      <div className="max-w-md mx-auto px-6 pt-4">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>
        <h1 className="text-2xl font-black mb-1">Welcome back</h1>
        <p className="text-muted-foreground text-sm mb-8">Sign in to your TacLink account.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            nav('/student');
          }}
          className="space-y-4"
        >
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
            <Input type="email" placeholder="you@example.com" className="bg-card border-border h-12 mt-1.5" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
            <Input type="password" placeholder="••••••••" className="bg-card border-border h-12 mt-1.5" />
          </div>
          <button type="button" className="text-xs text-primary font-semibold">Forgot password?</button>
          <Button type="submit" className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
            Sign In
          </Button>
        </form>
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Or</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <Button variant="outline" className="w-full h-12 bg-card border-border font-semibold" onClick={() => nav('/student')}>
          Continue with Google
        </Button>
        <div className="mt-8 text-center text-sm text-muted-foreground space-x-4">
          <button onClick={() => nav('/auth/student-signup')} className="text-primary font-semibold">Student Sign Up</button>
          <button onClick={() => nav('/auth/instructor-signup')} className="text-primary font-semibold">Instructor Sign Up</button>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
