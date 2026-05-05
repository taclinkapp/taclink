import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck, Loader2, Eye, EyeOff, Settings2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PaymentFailoverCard } from '@/components/admin/PaymentFailoverCard';
import { BackupRailsCard } from '@/components/admin/BackupRailsCard';

type Policy = {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
};

const DEFAULT_POLICY: Policy = {
  minLength: 12,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSymbol: true,
};

const POLICY_KEY = 'admin_pw_policy_v1';

const loadPolicy = (): Policy => {
  try {
    const raw = localStorage.getItem(POLICY_KEY);
    if (!raw) return DEFAULT_POLICY;
    return { ...DEFAULT_POLICY, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_POLICY;
  }
};

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
};

const PasswordField = ({ label, value, onChange, autoComplete }: FieldProps) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="relative mt-1.5">
        <Input
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 bg-background border-border pr-11"
          required
        />
        <button
          type="button"
          aria-label={show ? 'Hide password' : 'Show password'}
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 px-3 grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};

const Rule = ({ ok, label }: { ok: boolean; label: string }) => (
  <li className={cn('flex items-center gap-2 text-[11px]', ok ? 'text-green-500' : 'text-muted-foreground')}>
    {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-60" />}
    <span>{label}</span>
  </li>
);

const AdminSecurity = () => {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [policy, setPolicy] = useState<Policy>(loadPolicy);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const checks = useMemo(() => ({
    length: next.length >= policy.minLength,
    upper: !policy.requireUpper || /[A-Z]/.test(next),
    lower: !policy.requireLower || /[a-z]/.test(next),
    number: !policy.requireNumber || /[0-9]/.test(next),
    symbol: !policy.requireSymbol || /[^A-Za-z0-9]/.test(next),
  }), [next, policy]);

  const allOk = Object.values(checks).every(Boolean);

  const savePolicy = (p: Policy) => {
    setPolicy(p);
    try { localStorage.setItem(POLICY_KEY, JSON.stringify(p)); } catch {}
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return toast.error('No active session');
    if (!allOk) return toast.error('New password does not meet the policy');
    if (next !== confirm) return toast.error('New passwords do not match');
    if (next === current) return toast.error('New password must differ from the current one');

    setBusy(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email, password: current,
      });
      if (signInErr) return toast.error('Current password is incorrect');

      const { error: updErr } = await supabase.auth.updateUser({ password: next });
      if (updErr) return toast.error(updErr.message);

      toast.success('Password updated — signing you back in…');

      // Forced re-auth: sign out completely, then sign in with the new password.
      await supabase.auth.signOut();
      const { error: reErr } = await supabase.auth.signInWithPassword({
        email: user.email, password: next,
      });
      if (reErr) {
        toast.error('Please sign in again with your new password');
        nav('/auth/signin', { replace: true });
        return;
      }

      setCurrent(''); setNext(''); setConfirm('');
      toast.success('You are signed back in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <header>
        <div className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5" /> Admin Security
        </div>
        <h1 className="text-2xl font-bold mt-1">Update Admin Password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Change the password for <span className="font-mono">{user?.email}</span>. You'll be re-signed in automatically.
        </p>
      </header>

      {/* Policy editor */}
      <section className="tactical-card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Settings2 className="h-4 w-4 text-primary" /> Password Policy
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Minimum length: <span className="text-foreground font-mono">{policy.minLength}</span>
          </Label>
          <input
            type="range"
            min={8}
            max={32}
            value={policy.minLength}
            onChange={(e) => savePolicy({ ...policy, minLength: Number(e.target.value) })}
            className="w-full mt-2 accent-primary"
          />
        </div>
        {([
          ['requireUpper', 'Require uppercase letter'],
          ['requireLower', 'Require lowercase letter'],
          ['requireNumber', 'Require number'],
          ['requireSymbol', 'Require symbol'],
        ] as const).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm">{label}</span>
            <Switch
              checked={policy[key]}
              onCheckedChange={(v) => savePolicy({ ...policy, [key]: v })}
            />
          </div>
        ))}
      </section>

      {/* Password change form */}
      <form onSubmit={submit} className="tactical-card p-5 space-y-4">
        <PasswordField label="Current Password" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordField label="New Password" value={next} onChange={setNext} autoComplete="new-password" />
        <ul className="grid grid-cols-1 gap-1 -mt-2">
          <Rule ok={checks.length} label={`At least ${policy.minLength} characters`} />
          {policy.requireUpper && <Rule ok={checks.upper} label="One uppercase letter (A–Z)" />}
          {policy.requireLower && <Rule ok={checks.lower} label="One lowercase letter (a–z)" />}
          {policy.requireNumber && <Rule ok={checks.number} label="One number (0–9)" />}
          {policy.requireSymbol && <Rule ok={checks.symbol} label="One symbol (!@#$…)" />}
        </ul>
        <PasswordField label="Confirm New Password" value={confirm} onChange={setConfirm} autoComplete="new-password" />

        <Button type="submit" disabled={busy || !allOk} className="w-full h-11 font-bold">
          {busy ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating…</>)
                : (<><KeyRound className="h-4 w-4 mr-2" /> Update & Re-authenticate</>)}
        </Button>
      </form>

      {/* Backup payment processor in case the primary rail goes down */}
      <PaymentFailoverCard />
      <BackupRailsCard />
    </div>
  );
};

export default AdminSecurity;
