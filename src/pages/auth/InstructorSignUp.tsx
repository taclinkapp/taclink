import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/MobileShell';
import { Camera, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { US_STATES } from '@/lib/mockData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const InstructorSignUp = () => {
  const nav = useNavigate();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState('');
  const [bio, setBio] = useState('');
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password !== confirm) return toast.error('Passwords do not match');
    if (password.length < 8) return toast.error('Password must be at least 8 characters');
    if (!agree) return toast.error('You must agree to the terms');
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: `${first} ${last}`.trim(),
          phone,
          state,
          bio,
          role: 'instructor',
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Check your email', {
      description: 'Verify your email, then complete credential verification.',
    });
    nav('/auth/credential-verification');
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Instructor Application" back />
      <div className="max-w-md mx-auto px-6 py-6">
        <p className="text-muted-foreground text-sm mb-6">Apply to teach on TacLink. We'll verify your credentials within 1 hour.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center mb-2">
            <button type="button" className="h-28 w-28 rounded-full bg-card border-2 border-dashed border-primary/40 flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition">
              <Camera className="h-7 w-7" />
              <span className="text-[10px] mt-1 uppercase tracking-wider">Required</span>
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
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Phone</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-card border-border h-11 mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="bg-card border-border h-11 mt-1.5" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Confirm</Label>
              <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="bg-card border-border h-11 mt-1.5" />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">State</Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger className="bg-card border-border h-11 mt-1.5"><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent className="bg-card border-border max-h-64">
                {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Bio (max 500 chars)</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="bg-card border-border min-h-24 mt-1.5" placeholder="Tell students about your background and teaching style…" maxLength={500} />
          </div>
          <div className="flex items-start gap-3 pt-2">
            <Checkbox id="age" checked={agree} onCheckedChange={(v) => setAgree(!!v)} className="mt-0.5" />
            <label htmlFor="age" className="text-xs text-muted-foreground leading-relaxed">
              I confirm I am 18 or older and agree to the <span className="text-primary">Terms of Service</span> and <span className="text-primary">Privacy Policy</span>.
            </label>
          </div>
          <Button type="submit" disabled={loading} className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold mt-4">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply as Instructor'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default InstructorSignUp;
