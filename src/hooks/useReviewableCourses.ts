import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ReviewableBooking = {
  bookingId: string;
  attended_at: string | null;
  course: {
    id: string;
    title: string;
    category: string | null;
    instructor_id: string;
    starts_at: string | null;
    cover_image_url: string | null;
  };
  existingReview: {
    id: string;
    rating: number;
    comment: string | null;
    photo_url: string | null;
    created_at: string;
  } | null;
};

export const useReviewableCourses = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["reviewable-courses", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<ReviewableBooking[]> => {
      const { data: bookings, error: bErr } = await supabase
        .from("bookings")
        .select(
          "id, attended_at, course:courses(id, title, category, instructor_id, starts_at, cover_image_url)",
        )
        .eq("student_id", user!.id)
        .eq("status", "attended")
        .order("attended_at", { ascending: false });
      if (bErr) throw bErr;

      const rows = (bookings ?? []).filter((b: any) => b.course) as any[];
      if (rows.length === 0) return [];

      const courseIds = rows.map((r) => r.course.id);
      const { data: reviews, error: rErr } = await supabase
        .from("reviews")
        .select("id, course_id, rating, comment, photo_url, created_at")
        .eq("student_id", user!.id)
        .in("course_id", courseIds);
      if (rErr) throw rErr;

      const reviewByCourse = new Map<string, any>();
      (reviews ?? []).forEach((r: any) => reviewByCourse.set(r.course_id, r));

      return rows.map((r) => ({
        bookingId: r.id,
        attended_at: r.attended_at,
        course: r.course,
        existingReview: reviewByCourse.get(r.course.id) ?? null,
      }));
    },
  });
};
