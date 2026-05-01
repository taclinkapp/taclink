/**
 * Signup redirect telemetry
 * --------------------------------------------------------------------------
 * Lightweight client-side logging so we can debug where new accounts land in
 * production (instructor → /instructor/subscription, student → /student).
 *
 * Logs are:
 *   1. Always written to console with a `[signup]` prefix.
 *   2. Persisted to sessionStorage (last 20) for in-browser inspection.
 *   3. Best-effort POSTed to the `bug-triage` edge function as breadcrumbs
 *      so the admin Bug Triage view sees them — failure is swallowed.
 */
import { supabase } from "@/integrations/supabase/client";

export type SignupRedirectEvent = {
  role: "student" | "instructor";
  intendedPath: string;
  actualPath?: string;
  status: "submitted" | "redirected" | "landed" | "redirect_mismatch" | "error";
  message?: string;
  email?: string;
  ts: string;
};

const STORAGE_KEY = "taclink:signupRedirectLog";

const persist = (evt: SignupRedirectEvent) => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const list: SignupRedirectEvent[] = raw ? JSON.parse(raw) : [];
    list.push(evt);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-20)));
  } catch {
    /* sessionStorage may be unavailable in tests/SSR */
  }
};

export const logSignupRedirect = (
  evt: Omit<SignupRedirectEvent, "ts"> & { ts?: string },
) => {
  const event: SignupRedirectEvent = { ts: new Date().toISOString(), ...evt };
  // eslint-disable-next-line no-console
  console.info("[signup]", event);
  persist(event);
  // Note: we intentionally do NOT POST these to an edge function.
  // The signup flow runs as anonymous/student users, and admin-only
  // endpoints (like bug-triage) would 401/403 and surface as runtime
  // errors. Console + sessionStorage is enough for in-browser debugging.
};

export const getRecentSignupEvents = (): SignupRedirectEvent[] => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SignupRedirectEvent[]) : [];
  } catch {
    return [];
  }
};
