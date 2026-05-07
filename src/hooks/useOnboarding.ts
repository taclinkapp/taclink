import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChecklistKey,
  ChecklistState,
  DEFAULT_CHECKLIST,
  loadQuizLocal,
  clearQuizLocal,
} from "@/lib/onboarding";

type Row = {
  user_id: string;
  experience_level: string | null;
  training_goal: string | null;
  selected_pillars: string[] | null;
  travel_radius_miles: number | null;
  checklist: ChecklistState | null;
  checklist_dismissed: boolean;
  tooltips_seen: string[] | null;
  notif_prompt_shown: boolean;
  quiz_completed_at: string | null;
};

export function useOnboarding() {
  const { user } = useAuth();
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRow = useCallback(async () => {
    if (!user) { setRow(null); setLoading(false); return; }
    const { data } = await supabase
      .from("student_onboarding" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) {
      // Seed from local quiz answers (if any) on first sign-in.
      const local = loadQuizLocal();
      const seed = {
        user_id: user.id,
        experience_level: local.experience_level,
        training_goal: local.training_goal,
        selected_pillars: local.selected_pillars ?? [],
        travel_radius_miles: local.travel_radius_miles,
        quiz_completed_at: local.experience_level ? new Date().toISOString() : null,
      };
      const { data: inserted } = await supabase
        .from("student_onboarding" as any)
        .insert(seed)
        .select()
        .maybeSingle();
      clearQuizLocal();
      setRow((inserted as any) ?? (seed as any));
    } else {
      setRow(data as any);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchRow(); }, [fetchRow]);

  const update = useCallback(async (patch: Partial<Row>) => {
    if (!user) return;
    setRow((r) => (r ? { ...r, ...patch } : r));
    await supabase
      .from("student_onboarding" as any)
      .update(patch as any)
      .eq("user_id", user.id);
  }, [user]);

  const checkOff = useCallback(async (key: ChecklistKey) => {
    if (!row) return;
    const current = row.checklist ?? DEFAULT_CHECKLIST;
    if (current[key]) return;
    const next = { ...current, [key]: true };
    await update({ checklist: next });
  }, [row, update]);

  const dismissChecklist = useCallback(() => update({ checklist_dismissed: true }), [update]);

  const markTooltip = useCallback(async (id: string) => {
    if (!row) return;
    const seen = row.tooltips_seen ?? [];
    if (seen.includes(id)) return;
    await update({ tooltips_seen: [...seen, id] });
  }, [row, update]);

  const markNotifPromptShown = useCallback(() => update({ notif_prompt_shown: true }), [update]);

  const checklist = row?.checklist ?? DEFAULT_CHECKLIST;
  const completedCount = Object.values(checklist).filter(Boolean).length;
  const totalCount = Object.keys(DEFAULT_CHECKLIST).length;
  const allDone = completedCount === totalCount;

  return {
    loading,
    row,
    checklist,
    completedCount,
    totalCount,
    allDone,
    dismissed: row?.checklist_dismissed ?? false,
    tooltipsSeen: row?.tooltips_seen ?? [],
    notifPromptShown: row?.notif_prompt_shown ?? false,
    update,
    checkOff,
    dismissChecklist,
    markTooltip,
    markNotifPromptShown,
    refresh: fetchRow,
  };
}
