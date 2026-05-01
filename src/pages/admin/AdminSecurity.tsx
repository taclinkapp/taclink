import { useState } from 'react';
import { KeyRound, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const MIN_LEN = 10;

const AdminSecurity = () => {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) {
      toast.error('No active session');
      return;
    }
    if (next.length < MIN_LEN) {
      toast.error(`Password must be at least ${MIN_LEN} characters`);
      return;
    }
    if (next !== confirm) {
      toast.error('New passwords do not match');
      return;
    }
    if (next === current) {
      toast.error('New password must be different from the current one');
      return;
    }

    setBusy(true);
    try {
      // Re-authenticate with the current password to prove identity.
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      });
      if (signInErr) {
        toast.error('Current password is incorrect');
        return;
      }

      const { error: updErr } = await supabase.auth.updateUser({ password: next });
      if (updErr) {
        toast.error(updErr.message);
        return;
      }

      toast.success('Password updated');
      setCurrent('');
      setNext('');
      setConfirm('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-2xl">
      <header className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5" /> Admin Security
        </div>
        <h1 className="text-2xl font-bold mt-1">Update Admin Password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Change the password for <span className="font-mono">{user?.email}</span>. You'll stay
          signed in after the change.
        </p>
      </header>

      <form onSubmit={submit} className="tactical-card p-5 space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Current Password
          </Label>
          <Input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="mt-1.5 h-11 bg-background border-border"
            required
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            New Password
          </Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="mt-1.5 h-11 bg-background border-border"
            minLength={MIN_LEN}
            required
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Minimum {MIN_LEN} characters. Use a unique, strong password.
          </p>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Confirm New Password
          </Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1.5 h-11 bg-background border-border"
            minLength={MIN_LEN}
            required
          />
        </div>

        <Button type="submit" disabled={busy} className="w-full h-11 font-bold">
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating…
            </>
          ) : (
            <>
              <KeyRound className="h-4 w-4 mr-2" /> Update Password
            </>
          )}
        </Button>
      </form>
    </div>
  );
};

export default AdminSecurity;
