import { supabase } from "@/integrations/supabase/client";

export type DevUser = {
  id: string;
  name: string;
  role: "student" | "instructor" | "admin";
  email: string;
};

/**
 * Returns the currently signed-in user as a lightweight identity object,
 * compatible with the legacy DevUser shape used across the messaging UI.
 * Falls back to the legacy localStorage dev user if no real session exists
 * (used by the in-DEV role switcher only).
 */
export const getCurrentUser = (): DevUser | null => {
  try {
    const raw = localStorage.getItem("taclink:devUser");
    if (raw) return JSON.parse(raw) as DevUser;
  } catch {
    /* ignore */
  }
  return null;
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
  /**
   * Admin override — when true, the booking gate is skipped so admins can
   * open or create conversations for moderation/support without needing a
   * confirmed booking between the parties. Never set this from a regular
   * student or instructor flow.
   */
  bypassBookingGate?: boolean;
};

/**
 * Booking gate: returns true if the student has at least one confirmed
 * (reserved or attended) booking on a course owned by the instructor.
 * This is enforced before allowing a new conversation to be opened so
 * users cannot freely message each other off the back of a bypass attempt.
 */
export const hasConfirmedBookingBetween = async (
  studentId: string,
  instructorId: string,
): Promise<boolean> => {
  // Fetch instructor's course ids first, then check bookings.
  const { data: courses, error: courseErr } = await supabase
    .from("courses")
    .select("id")
    .eq("instructor_id", instructorId);
  if (courseErr) throw courseErr;
  const ids = (courses ?? []).map((c) => c.id);
  if (ids.length === 0) return false;

  const { data: bookings, error: bookErr } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("student_id", studentId)
    .in("course_id", ids)
    .in("status", ["reserved", "attended"])
    .limit(1);
  if (bookErr) throw bookErr;
  return (bookings?.length ?? 0) > 0;
};

export class BookingGateError extends Error {
  constructor() {
    super("A confirmed booking is required before you can message this user.");
    this.name = "BookingGateError";
  }
}

/**
 * Find an existing conversation between this student↔instructor (optionally
 * tied to a course) or create one. Enforces the booking gate on creation —
 * existing conversations remain accessible so prior history isn't lost.
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

  // Booking gate: only allow new threads when a confirmed booking exists.
  // Admins may bypass via explicit opt-in for moderation purposes.
  if (!args.bypassBookingGate) {
    const allowed = await hasConfirmedBookingBetween(studentId, instructorId);
    if (!allowed) throw new BookingGateError();
  }

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
  const { data: inserted, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      sender_role: senderRole,
      body,
    })
    .select("id")
    .single();
  if (error) throw error;

  // Fire-and-forget AI moderation. The edge function will hide the message
  // and queue it for admin review if it violates policy.
  const { moderateContent } = await import("@/lib/moderation");
  moderateContent({
    contentType: "message",
    contentId: inserted?.id ?? null,
    conversationId,
    text: body,
    authorId: senderId,
    authorRole: senderRole,
  }).catch(() => {});
};
