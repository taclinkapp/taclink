import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/MobileShell';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { validatePassword } from '@/lib/passwordRules';
import { PasswordRequirements } from '@/components/PasswordRequirements';

const ChangePassword = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !user?.email) return;
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (current && current === password) {
      toast.error('New password must be different from your current password');
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
    // Re-authenticate to confirm the current password belongs to this user.
    const { error: signinErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (signinErr) {
      setLoading(false);
      toast.error('Current password is incorrect');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Password updated');
    nav(-1);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Change Password" back />
      <div className="max-w-md mx-auto px-6 py-6">
        <p className="text-muted-foreground text-sm mb-6">
          Enter your current password, then choose a new one that meets the requirements below.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Current Password</Label>
            <Input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="bg-card border-border h-12 mt-1.5" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">New Password</Label>
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="bg-card border-border h-12 mt-1.5" />
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
      </div>
    </div>
  );
};

export default ChangePassword;
