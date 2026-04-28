import { supabase } from "@/integrations/supabase/client";

export type ModerationResult = {
  flagged: boolean;
  category: string;
  severity: string;
  reason: string;
};

type ContentType =
  | "message"
  | "course_text"
  | "course_image"
  | "review_image";

type ModerateArgs = {
  contentType: ContentType;
  contentId?: string | null;
  text?: string | null;
  imageUrl?: string | null;
  conversationId?: string | null;
  courseId?: string | null;
  authorId?: string | null;
  authorRole?: string | null;
};

/**
 * Calls the moderate-content edge function. Fail-open: if moderation is
 * unavailable we return `flagged: false` so legitimate writes are not blocked.
 */
export const moderateContent = async (
  args: ModerateArgs,
): Promise<ModerationResult> => {
  try {
    const { data, error } = await supabase.functions.invoke(
      "moderate-content",
      { body: args },
    );
    if (error) {
      console.warn("moderation invoke error", error);
      return { flagged: false, category: "none", severity: "none", reason: "" };
    }
    return data as ModerationResult;
  } catch (e) {
    console.warn("moderation failed", e);
    return { flagged: false, category: "none", severity: "none", reason: "" };
  }
};
