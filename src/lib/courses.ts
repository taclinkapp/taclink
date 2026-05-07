import { supabase } from "@/integrations/supabase/client";
import type { Course } from "@/lib/mockData";

export type DbCourse = {
  id: string;
  instructor_id: string;
  title: string;
  description: string | null;
  category: string | null;
  price_cents: number;
  duration_minutes: number | null;
  capacity: number | null;
  location_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  starts_at: string | null;
  ends_at: string | null;
  cover_image_url: string | null;
  gallery_urls?: string[] | null;
  status: string;
  skill_level?: string | null;
  created_at: string;
  updated_at: string;
};

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'all_levels';
export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all_levels: 'All Levels',
};

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1584282765846-2cb8b194a83a?auto=format&fit=crop&w=1200&q=70";

const toHHMM = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const toDateStr = (iso: string | null): string =>
  iso ? new Date(iso).toISOString().slice(0, 10) : "";

const durationLabel = (mins: number | null): string => {
  if (!mins) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h} hours`;
  return `${m} min`;
};

/** Adapter: DB row + instructor profile → existing UI Course shape. */
export const dbToViewCourse = (
  row: DbCourse,
  instructor?: { display_name?: string | null; photo_url?: string | null } | null,
): Course => {
  const cat = (row.category as Course["category"]) || "Other";
  return {
    id: row.id,
    title: row.title,
    category: cat,
    instructorId: row.instructor_id,
    instructorName: instructor?.display_name ?? "Instructor",
    instructorPhoto: instructor?.photo_url ?? "https://i.pravatar.cc/150?img=12",
    instructorVerified: true,
    instructorRating: 0,
    heroImage: row.cover_image_url || (row.gallery_urls && row.gallery_urls[0]) || PLACEHOLDER_IMG,
    gallery: row.gallery_urls ?? [],
    city: row.city ?? "",
    state: row.state ?? "",
    address: row.address ?? "",
    date: toDateStr(row.starts_at),
    startTime: toHHMM(row.starts_at),
    endTime: toHHMM(row.ends_at),
    duration: durationLabel(row.duration_minutes),
    bookingFee: Math.round((row.price_cents ?? 0) / 100),
    maxStudents: row.capacity ?? 0,
    spotsRemaining: row.capacity ?? 0, // bookings not yet wired
    description: row.description ?? "",
    whatYoullLearn: [],
    prerequisites: "",
    equipment: "",
    status: row.status === "draft" ? "draft" : row.status === "cancelled" ? "cancelled" : "active",
    skillLevel: (row.skill_level as any) ?? 'all_levels',
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
  };
};

export const fetchPublishedCourses = async (): Promise<Course[]> => {
  const { data: rows, error } = await supabase
    .from("courses")
    .select("*")
    .eq("status", "published")
    .neq("moderation_status", "flagged")
    .order("starts_at", { ascending: true });
  if (error) throw error;
  const list = (rows ?? []) as DbCourse[];
  if (list.length === 0) return [];
  const ids = Array.from(new Set(list.map((r) => r.instructor_id)));
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, display_name, photo_url")
    .in("id", ids);
  const map = new Map((profs ?? []).map((p) => [p.id, p]));
  return list.map((r) => dbToViewCourse(r, map.get(r.instructor_id)));
};

export const fetchCourseById = async (id: string): Promise<Course | null> => {
  const { data: row, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const { data: prof } = await supabase
    .from("profiles")
    .select("id, display_name, photo_url")
    .eq("id", (row as DbCourse).instructor_id)
    .maybeSingle();
  return dbToViewCourse(row as DbCourse, prof);
};

export const fetchInstructorCourses = async (
  instructorId: string,
): Promise<Course[]> => {
  const { data: rows, error } = await supabase
    .from("courses")
    .select("*")
    .eq("instructor_id", instructorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const list = (rows ?? []) as DbCourse[];
  const { data: prof } = await supabase
    .from("profiles")
    .select("id, display_name, photo_url")
    .eq("id", instructorId)
    .maybeSingle();
  return list.map((r) => dbToViewCourse(r, prof));
};

export type NewCourseInput = {
  title: string;
  description?: string;
  category?: string;
  price_cents: number;
  duration_minutes?: number;
  capacity?: number;
  address?: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
  starts_at?: string; // ISO
  ends_at?: string; // ISO
  cover_image_url?: string;
  gallery_urls?: string[];
  skill_level?: SkillLevel;
  in_person_waiver?: boolean;
  primary_pillar?: string;
  secondary_pillar?: string;
  status: "draft" | "published";
};

export const createCourse = async (
  instructorId: string,
  input: NewCourseInput,
) => {
  const { data, error } = await supabase
    .from("courses")
    .insert({ instructor_id: instructorId, ...input } as any)
    .select()
    .single();
  if (error) throw error;
  return data as DbCourse;
};

/**
 * Upload a course cover photo to the public `course-photos` bucket.
 * Files live under `<instructorId>/<filename>` so RLS limits writes to the
 * owning instructor while reads remain public.
 */
export const uploadCoursePhoto = async (
  instructorId: string,
  file: File,
): Promise<string> => {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${instructorId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("course-photos")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
  if (error) throw error;
  const { data } = supabase.storage.from("course-photos").getPublicUrl(path);
  return data.publicUrl;
};
