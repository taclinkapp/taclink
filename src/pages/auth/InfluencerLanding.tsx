import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { saveInfluencerSlug } from '@/lib/influencer';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type LinkRow = {
  id: string;
  slug: string;
  influencer_name: string;
  audience: 'student' | 'instructor' | 'both';
  active: boolean;
};

type Outcome =
  | 'matched_student'
  | 'matched_instructor'
  | 'chooser_shown'
  | 'audience_mismatch_fallback'
  | 'link_inactive'
  | 'link_not_found';

const logVisit = async (params: {
  slug: string;
  link_id: string | null;
  outcome: Outcome;
  audience_on_link: string | null;
  detected_role: string | null;
  user_id: string | null;
}) => {
  try {
    await supabase.from('influencer_link_redirect_log').insert({
      slug: params.slug,
      link_id: params.link_id,
      outcome: params.outcome,
      audience_on_link: params.audience_on_link,
      detected_role: params.detected_role,
      user_id: params.user_id,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
    });
  } catch {
    /* logging is best-effort */
  }
};

const InfluencerLanding = () => {
  const { slug = '' } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [link, setLink] = useState<LinkRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cleanSlug = slug.trim().toLowerCase();
      if (!cleanSlug) {
        setError('Invalid link');
        setLoading(false);
        return;
      }

      // Detect signed-in user role for fallback routing.
      let detectedRole: 'student' | 'instructor' | null = null;
      if (user?.id) {
        const { data: roleRows } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        const roles = (roleRows ?? []).map((r: any) => r.role);
        if (roles.includes('instructor')) detectedRole = 'instructor';
        else if (roles.includes('student')) detectedRole = 'student';
      }

      const { data, error: e } = await supabase
        .from('influencer_links_public')
        .select('id, slug, audience, active')
        .eq('slug', cleanSlug)
        .maybeSingle();
      if (cancelled) return;

      if (e || !data) {
        await logVisit({
          slug: cleanSlug, link_id: null, outcome: 'link_not_found',
          audience_on_link: null, detected_role: detectedRole, user_id: user?.id ?? null,
        });
        setError('This invite link is no longer active.');
        setLoading(false);
        return;
      }
      if (!data.active) {
        await logVisit({
          slug: cleanSlug, link_id: data.id, outcome: 'link_inactive',
          audience_on_link: data.audience, detected_role: detectedRole, user_id: user?.id ?? null,
        });
        setError('This invite link is no longer active.');
        setLoading(false);
        return;
      }

      saveInfluencerSlug(cleanSlug);
      setLink(data as LinkRow);
      setLoading(false);

      // Auto-route when audience is locked to a single role.
      if (data.audience === 'student') {
        await logVisit({
          slug: cleanSlug, link_id: data.id,
          outcome: detectedRole === 'instructor' ? 'audience_mismatch_fallback' : 'matched_student',
          audience_on_link: 'student', detected_role: detectedRole, user_id: user?.id ?? null,
        });
        nav(`/auth/student-signup?inf=${encodeURIComponent(cleanSlug)}`, { replace: true });
        return;
      }
      if (data.audience === 'instructor') {
        await logVisit({
          slug: cleanSlug, link_id: data.id,
          outcome: detectedRole === 'student' ? 'audience_mismatch_fallback' : 'matched_instructor',
          audience_on_link: 'instructor', detected_role: detectedRole, user_id: user?.id ?? null,
        });
        nav(`/auth/instructor-signup?inf=${encodeURIComponent(cleanSlug)}`, { replace: true });
        return;
      }

      // audience === 'both'. If we already know the visitor's role, fast-path them.
      if (detectedRole) {
        await logVisit({
          slug: cleanSlug, link_id: data.id, outcome: `matched_${detectedRole}` as Outcome,
          audience_on_link: 'both', detected_role: detectedRole, user_id: user?.id ?? null,
        });
        nav(
          `/auth/${detectedRole === 'instructor' ? 'instructor' : 'student'}-signup?inf=${encodeURIComponent(cleanSlug)}`,
          { replace: true },
        );
        return;
      }

      await logVisit({
        slug: cleanSlug, link_id: data.id, outcome: 'chooser_shown',
        audience_on_link: 'both', detected_role: null, user_id: user?.id ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, nav, user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="tactical-card p-6 max-w-sm text-center space-y-3">
          <Logo widthPx={140} />
          <h1 className="text-lg font-bold">Link unavailable</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => nav('/auth/student-signup')} className="w-full bg-primary text-primary-foreground font-bold">
            Sign up as a Student
          </Button>
          <Button onClick={() => nav('/auth/instructor-signup')} variant="outline" className="w-full font-bold">
            Sign up as an Instructor
          </Button>
        </div>
      </div>
    );
  }

  // audience === 'both' chooser
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="tactical-card p-6 max-w-sm w-full text-center space-y-4">
        <Logo showTagline widthPx={160} />
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Invited by</div>
          <div className="text-lg font-bold">{link?.influencer_name}</div>
        </div>
        <p className="text-sm text-muted-foreground">
          Pick how you want to join TacLink. You can always switch later.
        </p>
        <div className="space-y-3 pt-2">
          <Button
            onClick={() => nav(`/auth/student-signup?inf=${encodeURIComponent(slug)}`)}
            className="w-full h-12 bg-primary text-primary-foreground font-bold"
          >
            Sign up as a Student
          </Button>
          <Button
            onClick={() => nav(`/auth/instructor-signup?inf=${encodeURIComponent(slug)}`)}
            variant="outline"
            className="w-full h-12 font-bold"
          >
            Sign up as an Instructor
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InfluencerLanding;
