import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/MobileShell';
import { Logo } from '@/components/Logo';
import { Camera, Loader2, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { validatePassword } from '@/lib/passwordRules';
import { PasswordRequirements } from '@/components/PasswordRequirements';
import { readInfluencerSlug } from '@/lib/influencer';

const StudentSignUp = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const referralCode = (params.get('ref') ?? '').trim().toUpperCase();
  const influencerSlug = readInfluencerSlug();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);

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
    if (!agree) {
      toast.error('You must agree to the terms');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: `${first} ${last}`.trim(),
          role: 'student',
          ...(referralCode ? { referral_code: referralCode } : {}),
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Check your email', {
      description: 'We sent you a confirmation link to verify your account.',
    });
    nav('/auth/signin');
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Student Sign Up" back />
      <div className="max-w-md mx-auto px-6 py-6">
        <div className="flex justify-center mb-6">
          <Logo showTagline widthPx={180} />
        </div>
        <p className="text-muted-foreground text-sm mb-6">Create your free TacLink™ account to discover and book courses.</p>
        {referralCode && (
          <div className="tactical-card p-3 mb-5 flex items-center gap-3 border-primary/40">
            <div className="h-9 w-9 rounded-md bg-primary/15 flex items-center justify-center text-primary">
              <Gift className="h-4 w-4" />
            </div>
            <div className="text-xs">
              <div className="font-bold uppercase tracking-wider">Referral applied</div>
              <div className="text-muted-foreground">Code <span className="text-primary font-mono">{referralCode}</span> — your friend gets a reward when you book.</div>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center mb-2">
            <button type="button" className="h-24 w-24 rounded-full bg-card border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition">
              <Camera className="h-7 w-7" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">First Name</Label>
              <Input required value={first} onChange={(e) => setFirst(e.target.value)} className="bg-card border-border h-11 mt-1.5" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Last Name</Label>
              <Input required value={last} onChange={(e) => setLast(e.target.value)} className="bg-card border-border h-11 mt-1.5" />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-card border-border h-11 mt-1.5" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="bg-card border-border h-11 mt-1.5" />
            <PasswordRequirements password={password} className="mt-2" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Confirm Password</Label>
            <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="bg-card border-border h-11 mt-1.5" />
            {confirm && confirm !== password && (
              <p className="text-[11px] text-destructive mt-1.5">Passwords do not match</p>
            )}
          </div>
          <div className="flex items-start gap-3 pt-2">
            <Checkbox id="age" checked={agree} onCheckedChange={(v) => setAgree(!!v)} className="mt-0.5" />
            <label htmlFor="age" className="text-xs text-muted-foreground leading-relaxed">
              I confirm I am 18 or older and agree to the <span className="text-primary">Terms of Service</span> and <span className="text-primary">Privacy Policy</span>.
            </label>
          </div>
          <Button type="submit" disabled={loading} className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold mt-4">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Student Account'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default StudentSignUp;
