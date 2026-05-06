import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/MobileShell';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { validatePassword } from '@/lib/passwordRules';
import { PasswordRequirements } from '@/components/PasswordRequirements';

const ResetPassword = () => {
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verify we landed here via a recovery link (supabase exchanges the token
  // and emits a PASSWORD_RECOVERY event). Without it, deny the action.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });
    // Existing session also counts (e.g. user already exchanged the token).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    // If the URL itself signals an error (expired link, etc.) surface it.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const errDesc = hash.get('error_description');
    if (errDesc) setError(errDesc);
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    const { valid, failed } = validatePassword(password);
    if (!valid) {
      toast.error('Password does not meet requirements', {
        description: failed.map((r) => `• ${r.label}`).join('\n'),
      });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Password updated', { description: 'You can now sign in with your new password.' });
    await supabase.auth.signOut();
    nav('/auth/signin', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Reset Password" back />
      <div className="max-w-md mx-auto px-6 py-6">
        {error ? (
          <div className="tactical-card p-5 border-destructive/40">
            <h1 className="text-lg font-black mb-2">Reset link invalid</h1>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => nav('/auth/forgot-password')} className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
              Request a new link
            </Button>
          </div>
        ) : !ready ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Verifying reset link…
          </div>
        ) : (
          <>
            <p className="text-muted-foreground text-sm mb-6">Choose a new password for your account.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">New Password</Label>
                <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} className="bg-card border-border h-12 mt-1.5" />
                <PasswordRequirements password={password} className="mt-2" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Confirm New Password</Label>
                <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="bg-card border-border h-12 mt-1.5" />
                {confirm && confirm !== password && (
                  <p className="text-[11px] text-destructive mt-1.5">Passwords do not match</p>
                )}
              </div>
              <Button type="submit" disabled={loading} className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
