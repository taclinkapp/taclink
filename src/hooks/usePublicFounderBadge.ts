import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PublicFounderBadge = {
  user_id: string;
  founder_rank: number;
  founder_status: "active" | "pending_prelaunch";
};

/**
 * Public, read-only founder badge lookup for any user. Returns null when the
 * user isn't a founder, or when their status is revoked/expired (those are
 * intentionally hidden from public view).
 */
export const usePublicFounderBadge = (userId: string | null | undefined) => {
  return useQuery({
    queryKey: ["public_founder_badge", userId ?? "none"],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PublicFounderBadge | null> => {
      const { data, error } = await supabase.rpc("get_public_founder_badge", { _user_id: userId! });
      if (error) {
        console.warn("[founder badge] lookup failed", error);
        return null;
      }
      const row = Array.isArray(data) ? data[0] : data;
      return (row as PublicFounderBadge | undefined) ?? null;
    },
  });
};
