import { supabase } from "@/integrations/supabase/client";

export type DevUser = {
  id: string;
  name: string;
  role: "student" | "instructor" | "admin";
  email: string;
};

export const getCurrentUser = (): DevUser | null => {
  try {
    const raw = localStorage.getItem("taclink:devUser");
    if (!raw) return null;
    return JSON.parse(raw) as DevUser;
  } catch {
    return null;
  }
};

export type ConversationRow = {
  id: string;
  student_id: string;
  student_name: string | null;
  student_photo: string | null;
  instructor_id: string;
  instructor_name: string | null;
  instructor_photo: string | null;
  course_id: string | null;
  course_title: string | null;
  last_message: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "student" | "instructor";
  body: string;
  read_at: string | null;
  created_at: string;
};

type EnsureArgs = {
  studentId: string;
  studentName?: string;
  studentPhoto?: string;
  instructorId: string;
  instructorName?: string;
  instructorPhoto?: string;
  courseId?: string | null;
  courseTitle?: string | null;
};

/**
 * Find an existing conversation between this student↔instructor (optionally
 * tied to a course) or create one.
 */
export const ensureConversation = async (args: EnsureArgs): Promise<ConversationRow> => {
  const { studentId, instructorId, courseId = null } = args;

  let query = supabase
    .from("conversations")
    .select("*")
    .eq("student_id", studentId)
    .eq("instructor_id", instructorId);
  query = courseId
    ? query.eq("course_id", courseId)
    : query.is("course_id", null);

  const { data: existing, error: findErr } = await query.maybeSingle();
  if (findErr) throw findErr;
  if (existing) return existing as ConversationRow;

  const { data: created, error: insertErr } = await supabase
    .from("conversations")
    .insert({
      student_id: studentId,
      student_name: args.studentName ?? null,
      student_photo: args.studentPhoto ?? null,
      instructor_id: instructorId,
      instructor_name: args.instructorName ?? null,
      instructor_photo: args.instructorPhoto ?? null,
      course_id: courseId,
      course_title: args.courseTitle ?? null,
    })
    .select("*")
    .single();
  if (insertErr) throw insertErr;
  return created as ConversationRow;
};

export const sendMessage = async (
  conversationId: string,
  senderId: string,
  senderRole: "student" | "instructor",
  body: string,
) => {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    sender_role: senderRole,
    body,
  });
  if (error) throw error;
};
