import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/MobileShell';
import { Button } from '@/components/ui/button';
import { Gift, GraduationCap, Shield, Loader2, AlertTriangle } from 'lucide-react';

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

  const studentHref = `/auth/student-signup?ref=${encodeURIComponent(code)}`;
  const instructorHref = `/auth/instructor-signup?ref=${encodeURIComponent(code)}`;

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
                This referral link is invalid or expired. You can still create an account.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button onClick={() => nav('/auth/student-signup')} variant="outline" className="h-11 text-xs uppercase font-bold tracking-wider">Student</Button>
                <Button onClick={() => nav('/auth/instructor-signup')} className="h-11 bg-primary text-xs uppercase font-bold tracking-wider">Instructor</Button>
              </div>
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

            <h2 className="font-stencil uppercase tracking-[0.12em] text-sm mt-8 mb-3">Choose your account</h2>

            <Link to={studentHref} className="tactical-card p-4 flex items-center gap-3 hover:border-primary/40 mb-2 block">
              <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center text-primary">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm">Student</div>
                <div className="text-xs text-muted-foreground">Discover and book tactical training courses.</div>
              </div>
            </Link>

            <Link to={instructorHref} className="tactical-card p-4 flex items-center gap-3 hover:border-primary/40 block">
              <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm">Instructor</div>
                <div className="text-xs text-muted-foreground">Apply to teach courses on TacLink™.</div>
              </div>
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default InviteLanding;
