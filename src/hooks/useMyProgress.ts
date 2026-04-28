import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ProgressBooking = {
  id: string;
  status: "reserved" | "attended" | "cancelled" | "no_show";
  attended_at: string | null;
  booked_at: string;
  course: {
    id: string;
    title: string;
    category: string | null;
    starts_at: string | null;
    city: string | null;
    state: string | null;
    cover_image_url: string | null;
  } | null;
};

export const useMyProgress = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-progress", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<ProgressBooking[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, status, attended_at, booked_at, course:courses(id, title, category, starts_at, city, state, cover_image_url)",
        )
        .eq("student_id", user!.id)
        .order("booked_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProgressBooking[];
    },
  });
};
