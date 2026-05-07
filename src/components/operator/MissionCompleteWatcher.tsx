import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PILLAR_BY_ID, PillarId, getLevelInfo, computeTaclinkScore, getRankLabel, PILLARS } from "@/lib/pillars";
import { Trophy, ArrowUp } from "lucide-react";
import { Link } from "react-router-dom";

type AwardRow = {
  id: string;
  pillar: PillarId;
  xp: number;
  bonus_first_mission: number;
  bonus_full_day: number;
  bonus_multi_day: number;
  bonus_five_star: number;
  is_secondary: boolean;
  created_at: string;
  course_id: string;
};

type CelebrationPayload = {
  awards: AwardRow[];
  beforeTotals: Record<PillarId, number>;
  afterTotals: Record<PillarId, number>;
};

export const MissionCompleteWatcher = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [payload, setPayload] = useState<CelebrationPayload | null>(null);
  const [open, setOpen] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const STORAGE_KEY = `xp-seen-${user.id}`;

    const seed = async () => {
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
        if (Array.isArray(stored)) stored.forEach((id: string) => seenIds.current.add(id));
      } catch { /* ignore */ }
      const { data } = await (supabase as any)
        .from("student_xp_awards")
        .select("id")
        .eq("student_id", user.id);
      (data ?? []).forEach((r: { id: string }) => seenIds.current.add(r.id));
      initialized.current = true;
    };

    const persist = () => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(Array.from(seenIds.current).slice(-200)),
        );
      } catch { /* ignore */ }
    };

    const fetchAndShow = async () => {
      const { data } = await (supabase as any)
        .from("student_xp_awards")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (cancelled || !data) return;
      const fresh = (data as AwardRow[]).filter((r) => !seenIds.current.has(r.id));
      if (fresh.length === 0) return;

      // Group by booking burst (within 5s)
      const newest = fresh[0];
      const burst = fresh.filter(
        (r) =>
          Math.abs(new Date(r.created_at).getTime() - new Date(newest.created_at).getTime()) <
          5000,
      );

      // Read current totals (after) and reconstruct before
      const after: Record<PillarId, number> = PILLARS.reduce(
        (acc, p) => ({ ...acc, [p.id]: 0 }),
        {} as Record<PillarId, number>,
      );
      const { data: totalsRows } = await (supabase as any)
        .from("student_pillar_xp_v")
        .select("pillar,total_xp")
        .eq("student_id", user.id);
      (totalsRows ?? []).forEach((r: any) => {
        if (r.pillar in after) after[r.pillar as PillarId] = Number(r.total_xp) || 0;
      });
      const before = { ...after };
      burst.forEach((r) => {
        before[r.pillar] = Math.max(0, before[r.pillar] - r.xp);
      });

      burst.forEach((r) => seenIds.current.add(r.id));
      persist();
      setPayload({ awards: burst, beforeTotals: before, afterTotals: after });
      setOpen(true);
      qc.invalidateQueries({ queryKey: ["operator-profile", user.id] });
      // Mark "first completion" onboarding step (best-effort, ignores errors).
      (supabase as any)
        .from("student_onboarding")
        .update({ checklist: { profile_created: true, browsed_courses: true, followed_instructor: false, first_booking: true, first_completion: true, shared_profile: false } })
        .eq("user_id", user.id)
        .select("checklist")
        .maybeSingle()
        .then(() => {/* ignore */});
    };

    seed().then(() => {
      // Subscribe to inserts
      const ch = supabase
        .channel(`xp-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "student_xp_awards",
            filter: `student_id=eq.${user.id}`,
          },
          () => {
            // small debounce so the secondary pillar lands too
            setTimeout(fetchAndShow, 600);
          },
        )
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    });

    return () => { cancelled = true; };
  }, [user?.id, qc]);

  if (!payload) return null;

  const beforeScore = computeTaclinkScore(payload.beforeTotals);
  const afterScore = computeTaclinkScore(payload.afterTotals);
  const totalXp = payload.awards.reduce((s, a) => s + a.xp, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-primary/40 bg-gradient-to-br from-background via-background to-primary/10">
        <div className="p-6 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/15 border-2 border-primary/40 mb-3">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <div className="font-stencil text-2xl font-bold uppercase tracking-[0.18em] text-primary">
            Mission Complete
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            +{totalXp} XP earned
          </div>

          <div className="mt-5 space-y-3">
            {payload.awards.map((a) => {
              const meta = PILLAR_BY_ID[a.pillar];
              const before = getLevelInfo(payload.beforeTotals[a.pillar]);
              const after = getLevelInfo(payload.afterTotals[a.pillar]);
              const leveledUp = after.level > before.level;
              const bonuses: string[] = [];
              if (a.bonus_first_mission) bonuses.push(`+${a.bonus_first_mission} First Mission`);
              if (a.bonus_full_day) bonuses.push(`+${a.bonus_full_day} Full Day`);
              if (a.bonus_multi_day) bonuses.push(`+${a.bonus_multi_day} Multi-Day`);
              if (a.bonus_five_star) bonuses.push(`+${a.bonus_five_star} 5-Star`);

              return (
                <div key={a.id} className="tactical-card p-3 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">{meta.emoji}</span>
                      <div className="font-stencil font-bold uppercase text-sm">
                        {meta.name}
                        {a.is_secondary && (
                          <span className="ml-1 text-[9px] text-muted-foreground">(secondary)</span>
                        )}
                      </div>
                    </div>
                    <div className="font-stencil text-primary font-bold">+{a.xp} XP</div>
                  </div>

                  <div className="mt-2 h-2 rounded-full bg-surface overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-700"
                      style={{ width: `${after.toNext == null ? 100 : after.pctToNext}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
                    <span>L{after.level} · {after.label}</span>
                    <span>{after.totalXp} XP total</span>
                  </div>

                  {leveledUp && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-500">
                      <ArrowUp className="h-3 w-3" /> Level Up — {after.label}
                    </div>
                  )}
                  {bonuses.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {bonuses.map((b) => (
                        <span key={b} className="text-[9px] px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/30">
                          {b}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 tactical-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              TacLink Score
            </div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="font-stencil text-2xl text-muted-foreground line-through">
                {beforeScore}
              </span>
              <ArrowUp className="h-4 w-4 text-primary" />
              <span className="font-stencil text-3xl font-bold text-primary">
                {afterScore}
              </span>
            </div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-primary">
              {getRankLabel(afterScore)}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link to="/student/operator" onClick={() => setOpen(false)}>
              <Button variant="outline" className="w-full">View Profile</Button>
            </Link>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
