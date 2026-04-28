import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/MobileShell';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const StudentSignUp = () => {
  const nav = useNavigate();
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
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
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
        <p className="text-muted-foreground text-sm mb-6">Create your free TacLink account to discover and book courses.</p>
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
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Confirm Password</Label>
            <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="bg-card border-border h-11 mt-1.5" />
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
