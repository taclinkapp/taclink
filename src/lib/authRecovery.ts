const AUTH_RECOVERY_REDIRECT_KEY = "taclink_auth_recovery_redirected";
const AUTH_SIGNIN_ERROR_KEY = "auth_signin_error";

export const clearAuthStorage = () => {
  const clearStore = (store: Storage) => {
    for (let i = store.length - 1; i >= 0; i--) {
      const key = store.key(i);
      if (!key) continue;
      if (
        key === "supabase.auth.token" ||
        key === AUTH_RECOVERY_REDIRECT_KEY ||
        key === AUTH_SIGNIN_ERROR_KEY ||
        key.startsWith("sb-") ||
        key.startsWith("taclink_free_waiver_ack:") ||
        key === "taclink_last_activity_at"
      ) {
        store.removeItem(key);
      }
    }
  };

  try { clearStore(localStorage); } catch { /* ignore */ }
  try { clearStore(sessionStorage); } catch { /* ignore */ }
};

export const isRecoverableAuthError = (error: unknown) => {
  const raw = error instanceof Error
    ? `${error.name} ${error.message} ${error.stack ?? ""}`
    : String(error ?? "");
  const text = raw.toLowerCase();

  return (
    text.includes("bad session") ||
    text.includes("authsessionmissing") ||
    text.includes("auth session missing") ||
    text.includes("invalid refresh token") ||
    text.includes("refresh token not found") ||
    text.includes("session_not_found") ||
    text.includes("jwt expired") ||
    text.includes("invalid jwt")
  );
};

export const hasCachedAuthSession = () => {
  const hasSession = (store: Storage) => {
    for (let i = store.length - 1; i >= 0; i--) {
      const key = store.key(i);
      if (
        key === "supabase.auth.token" ||
        (key?.startsWith("sb-") && key.includes("-auth-token"))
      ) {
        return true;
      }
    }
    return false;
  };

  try { if (hasSession(localStorage)) return true; } catch { /* ignore */ }
  try { if (hasSession(sessionStorage)) return true; } catch { /* ignore */ }
  return false;
};

export const recoverFromStaleAuth = () => {
  clearAuthStorage();
  try {
    sessionStorage.setItem(
      AUTH_SIGNIN_ERROR_KEY,
      "Your previous sign-in expired, so TacLink cleared it. Sign in again to continue.",
    );
  } catch { /* ignore */ }

  if (typeof window === "undefined") return;
  const isSignInPage = window.location.pathname === "/auth/signin";
  const alreadyRedirectedOnSignIn = (() => {
    try { return sessionStorage.getItem(AUTH_RECOVERY_REDIRECT_KEY) === "1"; }
    catch { return false; }
  })();

  if (isSignInPage && alreadyRedirectedOnSignIn) return;

  try { sessionStorage.setItem(AUTH_RECOVERY_REDIRECT_KEY, "1"); } catch { /* ignore */ }
  window.location.replace("/auth/signin?authReset=1");
};

export const markAuthRecoveryHealthy = () => {
  try { sessionStorage.removeItem(AUTH_RECOVERY_REDIRECT_KEY); } catch { /* ignore */ }
};