import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type FounderStatus = "pending_prelaunch" | "active" | "expired" | "revoked";

export type FounderRecord = {
  user_id: string;
  founder_rank: number;
  qualified_at: string;
  launch_date_used: string | null;
  free_pro_starts_at: string | null;
  free_pro_ends_at: string | null;
  founder_status: FounderStatus;
  revoked_at: string | null;
  revoked_reason: string | null;
};

export type FounderState = {
  loading: boolean;
  isFounder: boolean;
  record: FounderRecord | null;
  isPendingPrelaunch: boolean;
  isActive: boolean;
  isExpired: boolean;
  isRevoked: boolean;
  /** True when founder is currently entitled to free Pro right now. */
  hasFreeProNow: boolean;
};

export const useFounderStatus = (): FounderState => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["founder_status", user?.id ?? "anon"] as const;

  const { data, isLoading } = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async (): Promise<FounderRecord | null> => {
      const { data, error } = await supabase.rpc("get_my_founder_status");
      if (error) {
        console.warn("[founder] get_my_founder_status failed", error);
        return null;
      }
      return (data as FounderRecord | null) ?? null;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`founder_${user.id}_${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "founding_instructors", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const now = Date.now();
  const startsAt = data?.free_pro_starts_at ? new Date(data.free_pro_starts_at).getTime() : null;
  const endsAt = data?.free_pro_ends_at ? new Date(data.free_pro_ends_at).getTime() : null;

  const isActive = data?.founder_status === "active";
  const hasFreeProNow = !!(
    isActive && startsAt !== null && startsAt <= now && (endsAt === null || endsAt > now)
  );

  return {
    loading: isLoading,
    isFounder: !!data && data.founder_status !== "revoked",
    record: data ?? null,
    isPendingPrelaunch: data?.founder_status === "pending_prelaunch",
    isActive,
    isExpired: data?.founder_status === "expired",
    isRevoked: data?.founder_status === "revoked",
    hasFreeProNow,
  };
};
