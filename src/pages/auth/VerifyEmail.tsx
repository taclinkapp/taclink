import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { homeForRole, useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const COOLDOWN_SECONDS = 30;

const VerifyEmail = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const role = params.get('role') ?? 'student';
  const { user, primaryRole, loading } = useAuth();
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // If the user confirms in another tab, AuthContext will pick it up via
  // onAuthStateChange. As soon as we have a session + role, send them home.
  if (!loading && user && primaryRole) {
    return <Navigate to={homeForRole(primaryRole)} replace />;
  }

  const resend = async () => {
    if (!email || resending || cooldown > 0) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/${role === 'instructor' ? 'instructor' : 'student'}` },
    });
    setResending(false);
    if (error) {
      toast.error('Could not resend', { description: error.message });
      return;
    }
    setCooldown(COOLDOWN_SECONDS);
    toast.success('Confirmation email resent');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-10">
      <div className="max-w-md w-full text-center space-y-6">
        <Logo className="h-10 w-auto mx-auto" />

        <div className="mx-auto h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center">
          <Mail className="h-8 w-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight">Confirm your email</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We sent a confirmation link to{' '}
            <span className="font-semibold text-foreground">{email || 'your email'}</span>.
            Click the link in that message to activate your account, then come back to sign in.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 text-left space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>Your account is created but inactive until you confirm.</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>Check your spam folder if you don't see it within a minute.</span>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={resend}
            disabled={resending || cooldown > 0 || !email}
            variant="outline"
            className="w-full h-12 font-semibold"
          >
            {resending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Resending…</>
            ) : cooldown > 0 ? (
              `Resend in ${cooldown}s`
            ) : (
              'Resend confirmation email'
            )}
          </Button>

          <Button
            onClick={() => nav('/auth/signin')}
            className="w-full h-12 font-bold"
          >
            I've confirmed — sign in
          </Button>

          <button
            onClick={() => nav('/')}
            className="w-full text-xs text-muted-foreground hover:text-foreground"
          >
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
