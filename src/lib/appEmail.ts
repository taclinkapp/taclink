import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget transactional email send.
 * Errors are logged but never thrown — emails should never block UI flows.
 */
export async function sendAppEmail(opts: {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData?: Record<string, unknown>;
}) {
  try {
    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: opts,
    });
    if (error) console.warn("[email] send failed", opts.templateName, error);
  } catch (e) {
    console.warn("[email] send threw", opts.templateName, e);
  }
}

export async function getUserEmail(userId: string | undefined | null) {
  if (!userId) return null;
  const { data } = await supabase.auth.getUser();
  if (data.user?.id === userId) return data.user.email ?? null;
  return null;
}
