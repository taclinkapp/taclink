import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { homeForRole, useAuth, type AppRole } from '@/contexts/AuthContext';
import { requestFounderBio } from '@/components/FounderBioModal';
import { toast } from 'sonner';

const COOLDOWN_SECONDS = 30;
const CODE_MIN_LENGTH = 6;
const CODE_MAX_LENGTH = 10;
const CODE_TTL_SECONDS = 180;

const VerifyEmail = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const emailParam = params.get('email') ?? '';
  const roleParam = params.get('role');
  const requestedRole = roleParam === 'instructor' || roleParam === 'student' ? roleParam : null;
  const { user, primaryRole, loading } = useAuth();
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [ttl, setTtl] = useState(CODE_TTL_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    if (ttl <= 0) return;
    const t = setInterval(() => setTtl((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [ttl]);

  const expired = ttl <= 0;

  // If the user confirms in another tab, AuthContext will pick it up via
  // onAuthStateChange. As soon as we have a session + role, send them home.
  if (!loading && user && primaryRole) {
    const dest = requestedRole === 'instructor' && primaryRole === 'instructor'
      ? '/auth/instructor/policy?resume=1'
      : homeForRole(primaryRole);
    return <Navigate to={dest} replace />;
  }

  const resolveVerifiedRole = async (fallback: AppRole | null, userId?: string): Promise<AppRole | null> => {
    if (fallback) return fallback;
    if (!userId) return null;
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
    const roles = ((data ?? []) as { role: AppRole }[]).map((r) => r.role);
    return roles.includes('admin') ? 'admin' : roles.includes('instructor') ? 'instructor' : roles.includes('student') ? 'student' : null;
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const token = code.replace(/\D/g, '');
    if (!normalizedEmail) {
      toast.error('Enter your email address');
      return;
    }
    if (expired) {
      toast.error('Code expired', { description: 'Request a new one to continue.' });
      return;
    }
    if (token.length !== CODE_LENGTH) {
      toast.error('Enter the 6-digit code');
      return;
    }
    setVerifying(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token,
      type: 'signup',
    });
    if (error) {
      setVerifying(false);
      toast.error('Code could not be verified', { description: error.message });
      return;
    }

    const role = await resolveVerifiedRole(requestedRole, data.user?.id);
    requestFounderBio();
    toast.success('Email confirmed');
    setVerifying(false);
    if (role === 'instructor') {
      nav('/auth/instructor/policy?resume=1', { replace: true });
    } else if (role === 'admin') {
      nav('/admin', { replace: true });
    } else {
      nav('/student', { replace: true });
    }
  };

  const resend = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || resending || cooldown > 0) return;
    setResending(true);
    const roleQuery = requestedRole ? `&role=${requestedRole}` : '';
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}${roleQuery}` },
    });
    setResending(false);
    if (error) {
      toast.error('Could not resend', { description: error.message });
      return;
    }
    setCooldown(COOLDOWN_SECONDS);
    setTtl(CODE_TTL_SECONDS);
    setCode('');
    toast.success('Verification code resent');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-10">
      <div className="max-w-md w-full text-center space-y-6">
        <Logo showTagline widthPx={180} className="mx-auto" />

        <div className="mx-auto h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center">
          <KeyRound className="h-8 w-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight">Enter your email code</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We sent a 6-digit confirmation code to{' '}
            <span className="font-semibold text-foreground">{email || 'your email'}</span>.
          </p>
        </div>

        <form onSubmit={verifyCode} className="space-y-3 text-left">
          {!emailParam && (
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-12 bg-card border-border"
            />
          )}
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            placeholder="000000"
            aria-label="6-digit verification code"
            className="h-14 bg-card border-border text-center text-2xl font-black tracking-[0.35em]"
          />
          <Button type="submit" disabled={verifying || expired || code.length !== CODE_LENGTH || !email.trim()} className="w-full h-12 font-bold">
            {verifying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirming…</> : expired ? 'Code expired' : 'Confirm & continue'}
          </Button>
          <p className={`text-xs text-center ${expired ? 'text-destructive' : 'text-muted-foreground'}`}>
            {expired
              ? 'This code has expired. Request a new one below.'
              : `Code expires in ${String(Math.floor(ttl / 60)).padStart(1, '0')}:${String(ttl % 60).padStart(2, '0')}`}
          </p>
        </form>

        <div className="rounded-lg border bg-card p-4 text-left space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>Your account is inactive until this code is confirmed.</span>
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
              'Resend verification code'
            )}
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
