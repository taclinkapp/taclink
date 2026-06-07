import { useAuth } from "@/contexts/AuthContext";
import { useOperatorProfile } from "@/hooks/useOperatorProfile";
import { PILLARS } from "@/lib/pillars";
import { MobileShell } from "@/components/MobileShell";
import { StudentTabBar } from "@/components/StudentTabBar";
import { Logo } from "@/components/Logo";
import { NotificationsBell } from "@/components/NotificationsBell";
import { PillarCard } from "@/components/operator/PillarCard";
import { Award, Clock, Calendar, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useOnboarding } from "@/hooks/useOnboarding";
import { FirstVisitTooltip } from "@/components/onboarding/FirstVisitTooltip";
import { getAvatarSrc } from "@/lib/avatar";

const OperatorProfile = () => {
  const { user, profile } = useAuth();
  const { data, isLoading } = useOperatorProfile(user?.id);
  const onboarding = useOnboarding();

  const handleShare = async () => {
    const url = window.location.href;
    const text = `My TacLink Score: ${data?.taclinkScore ?? 0}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Student Profile", text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast.success("Profile link copied");
      }
      if (!onboarding.checklist.shared_profile) onboarding.checkOff('shared_profile');
    } catch {
      /* user cancelled */
    }
  };

  return (
    <MobileShell>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 h-14 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <Logo showTagline className="h-7 w-auto" />
          <h1 className="font-stencil text-xl font-bold uppercase tracking-[0.12em] text-center">
            Student Profile
          </h1>
          <NotificationsBell className="h-9 w-9 rounded-full bg-card border border-border text-muted-foreground hover:text-primary" />
        </div>
      </header>

      <FirstVisitTooltip
        id="operator_profile_intro"
        title="Your Student Profile"
        body="Complete courses to earn XP and level up your 6 skill pillars. Hit top rank by stacking missions across all six."
      />

      <div className="px-4 py-4 pb-32 space-y-5">
        {/* Top hero card */}
        <section className="tactical-card p-5 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="mx-auto h-16 w-16 rounded-full bg-surface border border-border overflow-hidden mb-3">
              <img
                src={getAvatarSrc(profile?.photo_url, profile?.display_name)}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="font-stencil text-lg font-bold uppercase tracking-wider">
              {profile?.display_name ?? "Student"}
            </div>
            {profile?.state && (
              <div className="text-xs text-muted-foreground">{profile.state}</div>
            )}

            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                TacLink Score
              </div>
              <div className="font-stencil text-6xl font-bold text-primary leading-none mt-1">
                {data?.taclinkScore ?? 0}
              </div>
              <div className="mt-2 inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm bg-primary/15 text-primary border border-primary/30">
                {data?.rankLabel ?? "Civilian"}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-2"
              onClick={handleShare}
            >
              <Share2 className="h-3.5 w-3.5" /> Share Profile
            </Button>
          </div>
        </section>

        {/* 6 Pillars */}
        <section>
          <h2 className="font-stencil text-sm font-bold uppercase tracking-wider mb-3 px-1">
            Skill Pillars
          </h2>
          {isLoading ? (
            <div className="text-center text-muted-foreground text-sm py-8">Loading…</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {PILLARS.map((p) => (
                <PillarCard
                  key={p.id}
                  pillar={p.id}
                  xp={data?.pillarTotals[p.id] ?? 0}
                  compact
                />
              ))}
            </div>
          )}
        </section>

        {/* Stats footer */}
        <section className="grid grid-cols-3 gap-3">
          <div className="tactical-card p-3 text-center">
            <Award className="h-4 w-4 text-primary mx-auto mb-1" />
            <div className="font-stencil text-2xl font-bold">{data?.coursesCompleted ?? 0}</div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Courses</div>
          </div>
          <div className="tactical-card p-3 text-center">
            <Clock className="h-4 w-4 text-primary mx-auto mb-1" />
            <div className="font-stencil text-2xl font-bold">{data?.totalTrainingHours ?? 0}</div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Hours</div>
          </div>
          <div className="tactical-card p-3 text-center">
            <Calendar className="h-4 w-4 text-primary mx-auto mb-1" />
            <div className="font-stencil text-xs font-bold mt-1.5">
              {data?.memberSince
                ? new Date(data.memberSince).toLocaleDateString(undefined, {
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Member</div>
          </div>
        </section>
      </div>

      <StudentTabBar />
    </MobileShell>
  );
};

export default OperatorProfile;
