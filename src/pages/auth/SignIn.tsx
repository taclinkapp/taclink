import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/MobileShell';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useAuth, homeForRole } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import splashBg from '@/assets/splash-bg.mp4.asset.json';

const SignIn = () => {
  const nav = useNavigate();
  const location = useLocation();
  const { user, primaryRole } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Surface "account disabled" toast pushed from AuthContext after a forced sign-out
  useEffect(() => {
    try {
      const msg = sessionStorage.getItem('auth_signin_error');
      if (msg) {
        sessionStorage.removeItem('auth_signin_error');
        toast.error('Login disabled', { description: msg });
      }
    } catch {}
  }, []);

  // Redirect authenticated users away from sign-in.
  // Honor `from` only when it belongs to the role that just signed in;
  // otherwise fall back to the role's home. Prevents e.g. an admin landing
  // on `/instructor/subscription` because that URL was stashed pre-signin.
  useEffect(() => {
    if (user && primaryRole) {
      const from = (location.state as { from?: string } | null)?.from;
      const home = homeForRole(primaryRole);
      const roleAllows = (path: string) => {
        if (primaryRole === 'admin') return path.startsWith('/admin');
        if (primaryRole === 'instructor') return path.startsWith('/instructor');
        if (primaryRole === 'student') return path.startsWith('/student');
        return false;
      };
      const dest = from && roleAllows(from) ? from : home;
      nav(dest, { replace: true });
    }
  }, [user, primaryRole, nav, location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('banned') || msg.includes('user is banned') || msg.includes('disabled')) {
        toast.error('Login disabled', {
          description: 'This account has been disabled by an administrator. Please contact support.',
        });
      } else if (msg.includes('email not confirmed')) {
        toast.error('Please verify your email first', {
          description: 'Check your inbox for the confirmation link.',
        });
      } else if (msg.includes('invalid')) {
        toast.error('Invalid email or password');
      } else {
        toast.error(error.message);
      }
    }
    // success path handled by useEffect once session lands
  };

  const handleGoogle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (result.redirected) return; // browser is navigating to Google
      if (result.error) {
        setLoading(false);
        toast.error(result.error.message || 'Could not start Google sign-in');
        return;
      }
      // Tokens received and session set — redirect handled by useEffect once
      // primaryRole resolves from AuthContext.
    } catch (e) {
      setLoading(false);
      toast.error(e instanceof Error ? e.message : 'Google sign-in failed');
    }
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <video
        src={splashBg.url}
        autoPlay loop muted playsInline aria-hidden
        className="fixed inset-0 w-full h-full object-cover opacity-40 pointer-events-none"
      />
      <div aria-hidden className="fixed inset-0 bg-gradient-to-b from-background/60 via-background/70 to-background pointer-events-none" />
      <div className="relative z-10">
      <PageHeader back backTo="/" />
      <div className="max-w-md mx-auto px-6 pt-4">
        <div className="flex justify-center mb-8">
          <Logo showTagline widthPx={180} />
        </div>
        <h1 className="text-2xl font-black mb-1">Welcome back</h1>
        <p className="text-muted-foreground text-sm mb-8">Sign in to your TacLink™ account.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-card border-border h-12 mt-1.5"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
            <PasswordInput
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-card border-border h-12 mt-1.5"
            />
          </div>
          <button type="button" onClick={() => nav('/auth/forgot-password')} className="text-xs text-primary font-semibold">Forgot password?</button>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
          </Button>
        </form>
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Or</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          className="w-full h-12 bg-card border-border font-semibold"
          onClick={handleGoogle}
        >
          Continue with Google
        </Button>
        <div className="mt-8 text-center text-sm text-muted-foreground space-x-4">
          <button onClick={() => nav('/auth/student-signup')} className="text-primary font-semibold">Student Sign Up</button>
          <button onClick={() => nav('/auth/instructor-signup')} className="text-primary font-semibold">Instructor Sign Up</button>
        </div>
        <div className="mt-6 text-center">
          <button
            onClick={() => nav('/')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to landing page
          </button>
      </div>
      </div>
    </div>
    </div>
  );
};

export default SignIn;
