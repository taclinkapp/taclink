import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell, PageHeader } from '@/components/MobileShell';
import { InstructorTabBar } from '@/components/InstructorTabBar';
import { Settings, Star, MapPin, Award, Gift, ChevronRight } from 'lucide-react';
import { WatermarkedAvatar } from '@/components/WatermarkedAvatar';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { mockReviews, mockCourses } from '@/lib/mockData';
import { InviteFriendsSheet } from '@/components/InviteFriendsSheet';

const InstructorProfile = () => {
  const nav = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);
  return (
    <MobileShell>
      <PageHeader
        title="Profile"
        right={<button onClick={() => nav('/instructor/settings')} className="text-muted-foreground hover:text-primary p-2 -mr-2"><Settings className="h-5 w-5" /></button>}
      />
      {/* Cover */}
      <div className="relative h-32 bg-gradient-to-br from-primary/30 via-surface to-background">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(hsl(0 0% 16% / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 16% / 0.5) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
      </div>
      <div className="px-4 -mt-12 relative">
        <WatermarkedAvatar src="https://i.pravatar.cc/200?img=12" size={96} className="border-4 border-background" alt="Marcus Reyes" />
        <div className="flex items-center gap-1.5 mt-3">
          <h2 className="text-xl font-black">Marcus Reyes</h2>
          <VerifiedBadge className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-primary text-primary" /><span className="font-bold text-foreground">4.9</span> · 124 reviews</span>
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />Austin, TX</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mt-3">
          Former Marine. NRA-certified pistol & rifle instructor with 12 years of training experience. Focused on real-world defensive shooting.
        </p>

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
          {[
            { label: 'NRA Certified Pistol Instructor', verified: true },
            { label: 'Combat Veteran (DD-214)', verified: true },
            { label: 'TX Concealed Handgun License Instructor', verified: true },
          ].map((c) => (
            <div key={c.label} className="tactical-card p-3 flex items-center gap-3">
              <Award className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold flex-1">{c.label}</span>
              <VerifiedBadge />
            </div>
          ))}
        </Section>

        <Section title="Active Courses">
          {mockCourses.filter((c) => c.instructorId === 'i1').map((c) => (
            <div key={c.id} className="tactical-card p-3">
              <div className="text-sm font-semibold">{c.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{new Date(c.date).toLocaleDateString()}</div>
            </div>
          ))}
        </Section>

        <Section title="Reviews">
          {mockReviews.map((r) => (
            <div key={r.id} className="tactical-card p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <img src={r.studentPhoto} className="h-7 w-7 rounded-full" alt="" />
                <div className="text-sm font-semibold">{r.studentName}</div>
                <div className="flex ml-auto">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3 w-3 ${i < r.rating ? 'fill-primary text-primary' : 'text-border'}`} />)}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{r.comment}</p>
            </div>
          ))}
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
