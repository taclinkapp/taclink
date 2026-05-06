import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
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
import { logSignupRedirect } from '@/lib/signupLogging';

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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const onPickPhoto = (f: File | null | undefined) => {
    if (!f) return;
    if (!['image/jpeg','image/png','image/webp'].includes(f.type)) {
      toast.error('Photo must be JPG, PNG, or WEBP'); return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Photo must be 5MB or smaller'); return;
    }
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const uploadPhotoIfAny = async (userId: string) => {
    if (!photoFile) return;
    try {
      const ext = photoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('profile-photos').upload(path, photoFile, { contentType: photoFile.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('profile-photos').getPublicUrl(path);
      await supabase.from('profiles').update({ photo_url: pub.publicUrl }).eq('id', userId);
    } catch (e: any) {
      toast.error('Photo upload failed', { description: e?.message });
    }
  };

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
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) {
      await supabase.auth.signOut();
    }
    setLoading(true);
    logSignupRedirect({ role: 'student', intendedPath: '/student', status: 'submitted', email });
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/student`,
        data: {
          display_name: `${first} ${last}`.trim(),
          role: 'student',
          ...(referralCode ? { referral_code: referralCode } : {}),
          ...(influencerSlug ? { influencer_slug: influencerSlug } : {}),
        },
      },
    });
    if (error) {
      setLoading(false);
      logSignupRedirect({ role: 'student', intendedPath: '/student', status: 'error', email, message: error.message });
      toast.error(error.message);
      return;
    }
    // Upload photo if user provided one (best-effort)
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (uid) await uploadPhotoIfAny(uid);
    setLoading(false);
    toast.success('Welcome to TacLink™!');
    logSignupRedirect({ role: 'student', intendedPath: '/student', status: 'redirected', email });
    nav('/student', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Student Sign Up" back backTo="/" />
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
          <div className="flex flex-col items-center gap-2 mb-2">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => onPickPhoto(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="h-24 w-24 rounded-full bg-card border-2 border-dashed border-border overflow-hidden flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition"
              aria-label="Add profile photo"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Profile preview" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-7 w-7" />
              )}
            </button>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{photoFile ? 'Tap to change' : 'Add a photo (optional)'}</span>
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
            <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} className="bg-card border-border h-11 mt-1.5" />
            <PasswordRequirements password={password} className="mt-2" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Confirm Password</Label>
            <PasswordInput required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="bg-card border-border h-11 mt-1.5" />
            {confirm && confirm !== password && (
              <p className="text-[11px] text-destructive mt-1.5">Passwords do not match</p>
            )}
          </div>
          <div className="flex items-start gap-3 pt-2">
            <Checkbox id="age" checked={agree} onCheckedChange={(v) => setAgree(!!v)} className="mt-0.5" />
            <label htmlFor="age" className="text-xs text-muted-foreground leading-relaxed">
              I confirm I am 18 or older and agree to the{' '}
              <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">Terms of Service</a>
              {' '}and{' '}
              <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">Privacy Policy</a>.
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
