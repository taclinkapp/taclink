import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { InstructorTabBar } from '@/components/InstructorTabBar';
import { Settings, Star, MapPin, Award, Gift, ChevronRight } from 'lucide-react';
import { WatermarkedAvatar } from '@/components/WatermarkedAvatar';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { InviteFriendsSheet } from '@/components/InviteFriendsSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useInstructorCourses } from '@/hooks/useCourses';
import { supabase } from '@/integrations/supabase/client';
import { getAvatarSrc } from '@/lib/avatar';
import { fetchPublicProfileMap } from '@/lib/profilePhotos';

const InstructorProfile = () => {
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);

  const displayName = profile?.display_name ?? 'Instructor';
  const avatarSrc = getAvatarSrc(profile?.photo_url, displayName);
  const city = (profile as any)?.city ?? '';
  const state = (profile as any)?.state ?? '';
  const bio = (profile as any)?.bio ?? '';

  const { data: myCourses = [] } = useInstructorCourses(user?.id);
  const activeCourses = myCourses.filter((c) => c.status === 'active');

  const { data: credentials = [] } = useQuery({
    queryKey: ['instructor_credentials', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructor_credentials')
        .select('id, display_name, credential_type, status')
        .eq('instructor_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) return [];
      return (data ?? []).map((r: any) => ({
        id: r.id,
        label: r.display_name || r.credential_type,
        verified: r.status === 'approved',
      }));
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['instructor_reviews', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, student_id')
        .eq('instructor_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      const profileMap = await fetchPublicProfileMap((data ?? []).map((r: any) => r.student_id));
      return (data ?? []).map((r: any) => ({
        id: r.id,
        studentName: profileMap.get(r.student_id)?.display_name ?? 'Student',
        studentPhoto: profileMap.get(r.student_id)?.photo_url ?? '',
        rating: r.rating,
        comment: r.comment ?? '',
        date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }));
    },
  });

  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  return (
    <MobileShell>
      <PageHeader
        title="Profile"
        right={<button onClick={() => nav('/instructor/settings')} className="text-muted-foreground hover:text-primary p-2 -mr-2"><Settings className="h-5 w-5" /></button>}
      />
      <div className="relative h-32 bg-gradient-to-br from-primary/30 via-surface to-background">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(hsl(0 0% 16% / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 16% / 0.5) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
      </div>
      <div className="px-4 -mt-12 relative">
        <WatermarkedAvatar src={avatarSrc} size={96} className="border-4 border-background" alt={displayName} />
        <div className="flex items-center gap-1.5 mt-3">
          <h2 className="text-xl font-black">{displayName}</h2>
          {credentials.some((c: any) => c.verified) && <VerifiedBadge className="h-5 w-5" />}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          {avg && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-primary text-primary" />
              <span className="font-bold text-foreground">{avg}</span> · {reviews.length} review{reviews.length === 1 ? '' : 's'}
            </span>
          )}
          {(city || state) && (
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[city, state].filter(Boolean).join(', ')}</span>
          )}
        </div>
        {bio && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">{bio}</p>
        )}

        <Section title="Invite & Earn">
          <button
            onClick={() => setInviteOpen(true)}
            className="tactical-card w-full p-4 flex items-center gap-3 hover:border-primary/40 text-left"
          >
            <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center text-primary">
              <Gift className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">Invite & earn a free listing</div>
              <div className="text-xs text-muted-foreground">When your invite books their first course, you get a free listing credit.</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </Section>

        <Section title="Credentials">
          {credentials.length === 0 ? (
            <Link to="/instructor/credentials" className="tactical-card p-4 flex items-center gap-3 hover:border-primary/40">
              <Award className="h-4 w-4 text-primary" />
              <div className="flex-1 text-xs text-muted-foreground">
                No credentials uploaded yet. <span className="text-primary font-bold">Add some →</span>
              </div>
            </Link>
          ) : (
            credentials.map((c: any) => (
              <div key={c.id} className="tactical-card p-3 flex items-center gap-3">
                <Award className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold flex-1">{c.label}</span>
                {c.verified && <VerifiedBadge />}
              </div>
            ))
          )}
        </Section>

        <Section title="Active Courses">
          {activeCourses.length === 0 ? (
            <div className="tactical-card p-4 text-center text-xs text-muted-foreground">No active courses.</div>
          ) : (
            activeCourses.map((c) => (
              <Link key={c.id} to={`/instructor/courses/${c.id}`} className="tactical-card p-3 block hover:border-primary/40">
                <div className="text-sm font-semibold">{c.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {c.date ? new Date(c.date).toLocaleDateString() : '—'}
                </div>
              </Link>
            ))
          )}
        </Section>

        <Section title="Reviews">
          {reviews.length === 0 ? (
            <div className="tactical-card p-4 text-center text-xs text-muted-foreground">No reviews yet.</div>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="tactical-card p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  {r.studentPhoto
                    ? <img src={r.studentPhoto} className="h-7 w-7 rounded-full object-cover" alt="" />
                    : <div className="h-7 w-7 rounded-full bg-muted" />}
                  <div className="text-sm font-semibold">{r.studentName}</div>
                  <div className="flex ml-auto">
                    {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3 w-3 ${i < r.rating ? 'fill-primary text-primary' : 'text-border'}`} />)}
                  </div>
                </div>
                {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
              </div>
            ))
          )}
        </Section>
      </div>
      <InstructorTabBar />
      <InviteFriendsSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        rewardLabel="1 free course listing"
      />
    </MobileShell>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-6">
    <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold mb-3">{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
);

export default InstructorProfile;
