import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PILLARS,
  PillarId,
  computeTaclinkScore,
  getLevelInfo,
  PILLAR_BY_ID,
  LevelInfo,
} from "@/lib/pillars";

export type PillarTotals = Record<PillarId, number>;

export type OperatorProfile = {
  studentId: string;
  pillarTotals: PillarTotals;
  pillarLevels: Record<PillarId, LevelInfo>;
  taclinkScore: number;
  coursesCompleted: number;
  totalTrainingHours: number;
  memberSince: string | null;
};

const emptyTotals = (): PillarTotals =>
  PILLARS.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {} as PillarTotals);

async function fetchOperatorProfile(studentId: string): Promise<OperatorProfile> {
  const totals = emptyTotals();

  const { data: rows } = await (supabase as any)
    .from("student_pillar_xp_v")
    .select("pillar,total_xp")
    .eq("student_id", studentId);

  (rows ?? []).forEach((r: { pillar: PillarId; total_xp: number }) => {
    if (r.pillar in totals) totals[r.pillar] = Number(r.total_xp) || 0;
  });

  // Bookings — for counts + member since fallback
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, status, attended_at, course:courses(starts_at, ends_at)")
    .eq("student_id", studentId)
    .eq("status", "attended");

  const attended = bookings ?? [];
  const totalTrainingHours = attended.reduce((sum, b: any) => {
    const s = b.course?.starts_at ? new Date(b.course.starts_at).getTime() : null;
    const e = b.course?.ends_at ? new Date(b.course.ends_at).getTime() : null;
    if (s && e && e > s) return sum + (e - s) / 3_600_000;
    return sum;
  }, 0);

  const { data: profile } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", studentId)
    .maybeSingle();

  const pillarLevels = PILLARS.reduce(
    (acc, p) => ({ ...acc, [p.id]: getLevelInfo(totals[p.id]) }),
    {} as Record<PillarId, LevelInfo>,
  );

  const taclinkScore = computeTaclinkScore(totals);

  return {
    studentId,
    pillarTotals: totals,
    pillarLevels,
    taclinkScore,
    rankLabel: getRankLabel(taclinkScore),
    coursesCompleted: attended.length,
    totalTrainingHours: Math.round(totalTrainingHours * 10) / 10,
    memberSince: profile?.created_at ?? null,
  };
}

export function useOperatorProfile(studentId: string | undefined | null) {
  return useQuery({
    queryKey: ["operator-profile", studentId],
    queryFn: () => fetchOperatorProfile(studentId!),
    enabled: !!studentId,
    staleTime: 30_000,
  });
}

export { PILLARS, PILLAR_BY_ID };
