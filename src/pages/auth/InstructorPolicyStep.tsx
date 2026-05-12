import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/MobileShell';
import { ShieldCheck, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { LegalAcceptanceCard } from '@/components/legal/LegalAcceptanceCard';
import { InstructorDraftProgress } from '@/components/InstructorDraftProgress';
import {
  clearInstructorDraft,
  getInstructorDraft,
  updateInstructorDraft,
} from '@/lib/instructorSignupDraft';
import { requestFounderBio } from '@/components/FounderBioModal';
import { requestCrashCourseTour } from '@/components/CrashCourseTour';
import { logSignupRedirect } from '@/lib/signupLogging';
import splashBg from '@/assets/splash-bg.mp4.asset.json';

const POLICY_VERSION = 'v1.0';
const POST_VERIFY_UPLOAD_KEY = 'taclink_instructor_finalize_after_verify';

/**
 * Final onboarding step. Acknowledging the policy triggers the FIRST and
 * ONLY auth.signUp call. After the user is created we replay the draft:
 * upload photo, upload credential, insert credential row, choose free plan,
 * insert policy acknowledgment.
 */
const InstructorPolicyStep = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [agree, setAgree] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const resumeAfterVerify = params.get('resume') === '1';

  useEffect(() => {
    const draft = getInstructorDraft();
    if (!draft) {
      nav('/auth/instructor-signup', { replace: true });
      return;
    }
    if (!draft.plan) {
      nav('/auth/instructor/plan', { replace: true });
      return;
    }
    if (!draft.credentialType) {
      nav('/auth/instructor/credential', { replace: true });
    }
    if (resumeAfterVerify && draft.policyAcknowledged) {
      setAgree(true);
      setLegalAccepted(true);
    }
  }, [nav, resumeAfterVerify]);

  const finalize = async () => {
    const draft = getInstructorDraft();
    if (!draft || (!resumeAfterVerify && (!draft.credentialFile || !draft.photo))) {
      toast.error('Your application is incomplete. Please start over.');
      nav('/auth/instructor-signup', { replace: true });
      return;
    }
    if (!agree || !legalAccepted) return;

    setSubmitting(true);
    updateInstructorDraft({ policyAcknowledged: true });
    logSignupRedirect({
      role: 'instructor',
      intendedPath: '/instructor',
      status: 'submitted',
      email: draft.email,
    });

    let userId = user?.id;
    if (!resumeAfterVerify) {
      // 1) Create the auth user. This is the first server write of the flow.
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: draft.email,
        password: draft.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/verify-email?email=${encodeURIComponent(draft.email)}&role=instructor`,
          data: {
            display_name: `${draft.firstName} ${draft.lastName}`.trim(),
            state: draft.state,
            bio: draft.bio,
            role: 'instructor',
            ...(draft.referralCode ? { referral_code: draft.referralCode } : {}),
            ...(draft.influencerSlug ? { influencer_slug: draft.influencerSlug } : {}),
          },
        },
      });
      if (signUpErr) {
        setSubmitting(false);
        toast.error('Could not create your account', { description: signUpErr.message });
        return;
      }

      userId = signUpData.user?.id;
      if (!signUpData.session) {
        updateInstructorDraft({ policyAcknowledged: true, authAccountCreated: true });
        try { sessionStorage.setItem(POST_VERIFY_UPLOAD_KEY, '1'); } catch {}
        setSubmitting(false);
        toast.success('Account created', { description: 'Enter the email code to finish setup.' });
        nav(`/auth/verify-email?email=${encodeURIComponent(draft.email)}&role=instructor`, { replace: true });
        return;
      }
    }
    if (!userId) {
      setSubmitting(false);
      toast.error('Confirm your email first', { description: 'Enter the code from your email to finish setup.' });
      nav(`/auth/verify-email?email=${encodeURIComponent(draft.email)}&role=instructor`, { replace: true });
      return;
    }

    // 2) Replay the rest of the draft. Failures here are non-fatal — we
    // toast and let the in-app onboarding gate guide the user to fix them.
    try {
      if (draft.photo) {
        const photo = draft.photo;
        const ext = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const path = `${userId}/avatar-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('profile-photos')
          .upload(path, photo, { contentType: photo.type, upsert: false });
        if (!upErr) {
          const { data: pub } = supabase.storage.from('profile-photos').getPublicUrl(path);
          await supabase.from('profiles').update({ photo_url: pub.publicUrl }).eq('id', userId);
        }
      }
    } catch (err) {
      console.error('Photo upload failed', err);
    }

    try {
      if (draft.credentialFile) {
        const cred = draft.credentialFile;
        const cExt = cred.name.split('.').pop()?.toLowerCase() ?? 'bin';
        const cPath = `${userId}/${Date.now()}-${draft.credentialType ?? 'credential'}.${cExt}`;
        const { error: cUpErr } = await supabase.storage
          .from('credentials')
          .upload(cPath, cred, { contentType: cred.type, upsert: false });
        if (cUpErr) throw cUpErr;
        await supabase.from('instructor_credentials').insert({
          instructor_id: userId,
          credential_type: draft.credentialType ?? 'other',
          display_name: draft.credentialDisplayName ?? draft.credentialType ?? 'Credential',
          file_path: cPath,
          file_mime: cred.type,
        });
      }
    } catch (err: any) {
      console.error('Credential upload failed', err);
      toast.error('Credential upload failed', { description: err?.message });
    }

    try {
      await supabase.rpc('instructor_choose_free_plan');
    } catch (err) {
      console.error('instructor_choose_free_plan failed', err);
    }

    try {
      await supabase.from('policy_acknowledgments').insert([
        { user_id: userId, policy_version: POLICY_VERSION, user_agent: navigator.userAgent },
        { user_id: userId, policy_version: 'privacy-v1.0', user_agent: navigator.userAgent },
        { user_id: userId, policy_version: 'terms-v1.0', user_agent: navigator.userAgent },
      ]);
    } catch (err) {
      console.error('policy ack insert failed', err);
    }

    clearInstructorDraft();
    setSubmitting(false);
    toast.success('Account ready', {
      description: draft.credentialFile
        ? 'Welcome to TacLink — your credential is being reviewed.'
        : 'Welcome to TacLink — finish credential upload to complete onboarding.',
    });
    requestFounderBio();
    requestCrashCourseTour('instructor');
    nav('/instructor', { replace: true });
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <video
        src={splashBg.url}
        autoPlay loop muted playsInline aria-hidden
        className="fixed inset-0 w-full h-full object-cover opacity-40 pointer-events-none"
      />
      <div aria-hidden className="fixed inset-0 bg-gradient-to-b from-background/60 via-background/70 to-background pointer-events-none" />
      <div className="relative z-10">
        <PageHeader title="Final Step" back backTo="/auth/instructor/credential" />
        <div className="max-w-md mx-auto px-6 py-6 space-y-5">
          <InstructorDraftProgress
            current="policy"
            completed={{ account: true, plan: true, credential: true }}
          />

          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">Keep TacLink™ safe</h1>
                <p className="text-xs text-muted-foreground">Final policy acknowledgment</p>
              </div>
            </div>

            <div className="flex gap-2 text-sm">
              <Lock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <p>
                <span className="font-bold">Bookings, messages, and payments stay on TacLink.</span>{' '}
                Payment is processed securely in-app and held in escrow — funds only release after the course runs.
                Don't share contact info or arrange training off-platform.
              </p>
            </div>

            {resumeAfterVerify ? (
              <div className="tactical-card p-4 flex items-start gap-3 text-sm">
                <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold">Agreement accepted</div>
                  <p className="text-xs text-muted-foreground mt-1">Finish setup to record it on your verified account.</p>
                </div>
              </div>
            ) : (
              <LegalAcceptanceCard onAcceptedChange={setLegalAccepted} />
            )}

            <div className="flex items-start gap-3 pt-1">
              <Checkbox id="ack" checked={agree} onCheckedChange={(v) => setAgree(!!v)} className="mt-0.5" />
              <label htmlFor="ack" className="text-xs text-muted-foreground leading-relaxed">
                I understand and agree to keep all interactions, bookings, and payments on TacLink.
              </label>
            </div>

            <Button
              onClick={finalize}
              disabled={!agree || !legalAccepted || submitting}
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : resumeAfterVerify ? 'Finish Instructor Setup' : 'Acknowledge & Create Account'}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Your account is created only after you tap the button above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstructorPolicyStep;
