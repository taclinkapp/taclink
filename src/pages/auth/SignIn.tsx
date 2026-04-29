import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/MobileShell';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, homeForRole } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const SignIn = () => {
  const nav = useNavigate();
  const location = useLocation();
  const { user, primaryRole } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect authenticated users away from sign-in
  useEffect(() => {
    if (user && primaryRole) {
      const dest = (location.state as { from?: string } | null)?.from ?? homeForRole(primaryRole);
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
      if (error.message.toLowerCase().includes('email not confirmed')) {
        toast.error('Please verify your email first', {
          description: 'Check your inbox for the confirmation link.',
        });
      } else if (error.message.toLowerCase().includes('invalid')) {
        toast.error('Invalid email or password');
      } else {
        toast.error(error.message);
      }
    }
    // success path handled by useEffect once session lands
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader back />
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
            <Input
              type="password"
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
      </div>
    </div>
  );
};

export default SignIn;
