import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { saveInfluencerSlug } from '@/lib/influencer';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type LinkRow = {
  slug: string;
  influencer_name: string;
  audience: 'student' | 'instructor' | 'both';
  active: boolean;
};

const InfluencerLanding = () => {
  const { slug = '' } = useParams();
  const nav = useNavigate();
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
      const { data, error: e } = await supabase
        .from('influencer_links')
        .select('slug, influencer_name, audience, active')
        .eq('slug', cleanSlug)
        .maybeSingle();
      if (cancelled) return;
      if (e || !data || !data.active) {
        setError('This invite link is no longer active.');
        setLoading(false);
        return;
      }
      saveInfluencerSlug(cleanSlug);
      setLink(data as LinkRow);
      setLoading(false);

      // Auto-route when audience is locked to a single role.
      if (data.audience === 'student') {
        nav(`/auth/student-signup?inf=${encodeURIComponent(cleanSlug)}`, { replace: true });
      } else if (data.audience === 'instructor') {
        nav(`/auth/instructor-signup?inf=${encodeURIComponent(cleanSlug)}`, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, nav]);

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
          <Button onClick={() => nav('/')} className="w-full bg-primary text-primary-foreground font-bold">
            Continue to TacLink
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
