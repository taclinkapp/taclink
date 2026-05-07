import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/MobileShell';
import { Logo } from '@/components/Logo';
import { Camera, Loader2, Gift } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { US_STATES } from '@/lib/mockData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { detectContactInfo } from '@/lib/contactRedaction';
import { logBypassAttempt } from '@/lib/bypassLogging';
import { ContactInfoWarning } from '@/components/ContactInfoWarning';
import { validatePassword } from '@/lib/passwordRules';
import { PasswordRequirements } from '@/components/PasswordRequirements';
import { readInfluencerSlug } from '@/lib/influencer';
import { logSignupRedirect } from '@/lib/signupLogging';
import { PhotoAdjusterDialog } from '@/components/instructor/PhotoAdjusterDialog';

const InstructorSignUp = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const referralCode = (params.get('ref') ?? '').trim().toUpperCase();
  const influencerSlug = readInfluencerSlug();
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [rawPhoto, setRawPhoto] = useState<File | null>(null);
  const [adjusterOpen, setAdjusterOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const onPickPhoto = (f: File | null | undefined) => {
    if (!f) return;
    if (!['image/jpeg','image/png','image/webp'].includes(f.type)) {
      toast.error('Photo must be JPG, PNG, or WEBP'); return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Photo must be 5MB or smaller'); return;
    }
    setRawPhoto(f);
    setAdjusterOpen(true);
  };

  const onAdjusted = (file: File) => {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
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
    if (password !== confirm) return toast.error('Passwords do not match');
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return toast.error('Password does not meet requirements', {
        description: pwCheck.failed.map((r) => `• ${r.label}`).join('\n'),
      });
    }
    if (!agree) return toast.error('You must agree to the terms');
    const bioHits = detectContactInfo(bio);
    if (bioHits.length) {
      logBypassAttempt({ userRole: 'instructor', fieldName: 'instructor_bio', originalContent: bio, detections: bioHits, actionTaken: 'blocked' });
      return toast.error('Remove contact info from your bio before submitting.');
    }
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) {
      await supabase.auth.signOut();
    }
    setLoading(true);
    logSignupRedirect({ role: 'instructor', intendedPath: '/instructor/subscription?onboarding=1', status: 'submitted', email });
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/instructor/subscription?onboarding=1`,
        data: {
          display_name: `${first} ${last}`.trim(),
          phone,
          state,
          bio,
          role: 'instructor',
          ...(referralCode ? { referral_code: referralCode } : {}),
          ...(influencerSlug ? { influencer_slug: influencerSlug } : {}),
        },
      },
    });
    if (error) {
      setLoading(false);
      logSignupRedirect({ role: 'instructor', intendedPath: '/instructor/subscription?onboarding=1', status: 'error', email, message: error.message });
      toast.error(error.message);
      return;
    }
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (uid) await uploadPhotoIfAny(uid);
    setLoading(false);
    toast.success('Account created', {
      description: 'Choose your plan to get started.',
    });
    logSignupRedirect({ role: 'instructor', intendedPath: '/instructor/subscription?onboarding=1', status: 'redirected', email });
    nav('/instructor/subscription?onboarding=1', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Instructor Application" back backTo="/" />
      <div className="max-w-md mx-auto px-6 py-6">
        <div className="flex justify-center mb-6">
          <Logo showTagline widthPx={180} />
        </div>
        <p className="text-muted-foreground text-sm mb-6">Apply to teach on TacLink™. We'll verify your credentials within 1 hour.</p>
        {referralCode && (
          <div className="tactical-card p-3 mb-5 flex items-center gap-3 border-primary/40">
            <div className="h-9 w-9 rounded-md bg-primary/15 flex items-center justify-center text-primary">
              <Gift className="h-4 w-4" />
            </div>
            <div className="text-xs">
              <div className="font-bold uppercase tracking-wider">Referral applied</div>
              <div className="text-muted-foreground">Code <span className="text-primary font-mono">{referralCode}</span> — your friend earns a reward when you book your first course.</div>
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
              className="h-28 w-28 rounded-full bg-card border-2 border-dashed border-primary/40 overflow-hidden flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition"
              aria-label="Add profile photo"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Profile preview" className="h-full w-full object-cover" />
              ) : (
                <>
                  <Camera className="h-7 w-7" />
                  <span className="text-[10px] mt-1 uppercase tracking-wider">Required</span>
                </>
              )}
            </button>
            {photoFile && (
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider">
                <button type="button" onClick={() => rawPhoto && setAdjusterOpen(true)} className="text-primary font-bold hover:underline">Adjust</button>
                <button type="button" onClick={() => photoInputRef.current?.click()} className="text-muted-foreground hover:text-foreground">Replace</button>
              </div>
            )}
          </div>
          <PhotoAdjusterDialog
            open={adjusterOpen}
            onClose={() => setAdjusterOpen(false)}
            source={rawPhoto}
            aspect="1:1"
            initialMode="fill"
            outputMaxWidth={800}
            filename="avatar.jpg"
            onSave={onAdjusted}
          />
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
          <PhoneVerificationField
            phone={phone}
            onPhoneChange={setPhone}
            verified={phoneVerified}
            onVerified={(p) => { if (p) { setPhone(p); setPhoneVerified(true); } else { setPhoneVerified(false); } }}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
              <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} className="bg-card border-border h-11 mt-1.5" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Confirm</Label>
              <PasswordInput required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="bg-card border-border h-11 mt-1.5" />
            </div>
          </div>
          <PasswordRequirements password={password} />
          {confirm && confirm !== password && (
            <p className="text-[11px] text-destructive -mt-2">Passwords do not match</p>
          )}
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
            <ContactInfoWarning value={bio} className="mt-2" />
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
          <Button type="submit" disabled={loading || !phoneVerified} className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold mt-4">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply as Instructor'}
          </Button>
          {!phoneVerified && (
            <p className="text-[11px] text-muted-foreground text-center mt-2">Verify your phone number to continue.</p>
          )}
        </form>
      </div>
    </div>
  );
};

export default InstructorSignUp;
