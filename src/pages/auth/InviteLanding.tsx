import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Gift, Shield, Loader2, AlertTriangle, GraduationCap } from 'lucide-react';

const InviteLanding = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = (rawCode ?? '').trim().toUpperCase();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [referrer, setReferrer] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code) {
        setLoading(false);
        return;
      }
      // Persist the referral code so downstream signup screens (and the
      // /welcome → quiz → signup flow) can attach it even without a query param.
      try {
        sessionStorage.setItem('pendingReferralCode', code);
      } catch {
        /* storage unavailable */
      }
      const { data: rows } = await supabase
        .rpc('lookup_referral_code', { _code: code });
      if (cancelled) return;
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) {
        setLoading(false);
        return;
      }
      setReferrer({ name: row.display_name ?? 'A TacLink™ user', role: row.user_role });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const goFindMission = () => nav(`/auth/student-signup${code ? `?ref=${encodeURIComponent(code)}` : ''}`);
  const goInstructor = () => nav(`/auth/instructor-signup?ref=${encodeURIComponent(code)}`);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="You're invited" back backTo="/" />
      <div className="max-w-md mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !code || !referrer ? (
          <div className="tactical-card p-5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="font-bold uppercase tracking-wider text-sm">Invalid invite</div>
              <p className="text-xs text-muted-foreground mt-1">
                This referral link is invalid or expired. You can still explore courses.
              </p>
              <Button onClick={goFindMission} className="mt-4 h-11 w-full bg-primary text-xs uppercase font-bold tracking-wider">
                Find Your Next Mission
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="tactical-card p-5 border-primary/40">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-md bg-primary/15 flex items-center justify-center text-primary">
                  <Gift className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Referral applied</div>
                  <div className="font-bold truncate">{referrer.name} invited you</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Code <span className="font-mono text-primary">{code}</span> will be applied to your signup. When you complete your first booking, your friend earns a reward.
              </div>
            </div>

            <Button
              onClick={goFindMission}
              className="mt-6 h-14 w-full bg-primary text-primary-foreground font-bold uppercase tracking-wider"
            >
              <GraduationCap className="h-5 w-5" /> Sign Up as a Student
            </Button>

            <button
              onClick={goInstructor}
              className="mt-3 w-full h-11 inline-flex items-center justify-center gap-2 text-xs uppercase font-bold tracking-wider text-muted-foreground hover:text-foreground"
            >
              <Shield className="h-4 w-4" /> Apply as an instructor instead
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default InviteLanding;
