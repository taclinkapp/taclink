import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "student" | "instructor" | "admin";

export type Profile = {
  id: string;
  display_name: string | null;
  photo_url: string | null;
  phone: string | null;
  state: string | null;
  bio: string | null;
  payment_method_added?: boolean | null;
  subscription_status?: string | null;
  account_status?: 'active' | 'warned' | 'suspended' | 'disabled' | string | null;
  strike_points?: number | null;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
  loading: boolean;
  rolesError: string | null;
  retryRoles: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

const MAX_ROLE_RETRIES = 3;
const AUTH_CACHE_FIX_KEY = 'taclink_auth_cache_fix_2026_06_10';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const activeUserIdRef = useRef<string | null>(null);

  const clearLocalAuthArtifacts = () => {
    const clearStore = (store: Storage) => {
      for (let i = store.length - 1; i >= 0; i--) {
        const k = store.key(i);
        if (!k) continue;
        if (
          k === 'supabase.auth.token' ||
          (k.startsWith('sb-') && (k.includes('-auth-token') || k.includes('-code-verifier'))) ||
          k.startsWith('taclink_free_waiver_ack:')
        ) {
          store.removeItem(k);
        }
      }
    };

    try { clearStore(localStorage); } catch { /* ignore */ }
    try { clearStore(sessionStorage); } catch { /* ignore */ }
  };

  const resetAuthState = () => {
    activeUserIdRef.current = null;
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
    setRolesError(null);
    setLoading(false);
  };

  const forceLocalSignedOut = () => {
    clearLocalAuthArtifacts();
    resetAuthState();
  };

  const loadProfileAndRoles = async (uid: string, attempt = 0): Promise<void> => {
    try {
      if (activeUserIdRef.current !== uid) return;
      const [{ data: prof, error: profErr }, { data: roleRows, error: roleErr }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      if (activeUserIdRef.current !== uid) return;
      if (roleErr) throw roleErr;
      if (profErr && profErr.code !== "PGRST116") throw profErr;
      const nextRoles = ((roleRows as { role: AppRole }[]) ?? []).map((r) => r.role);
      if (!nextRoles.length) throw new Error("No account role has been assigned yet.");

      // Defensive guard: if an admin soft-deleted this user, force sign-out.
      // The auth user is also banned server-side, but this catches any stale session.
      if ((prof as Profile | null)?.account_status === 'disabled') {
        try {
          sessionStorage.setItem(
            'auth_signin_error',
            'This account has been disabled by an administrator. Please contact support.'
          );
        } catch {
          // sessionStorage can be unavailable in private/browser-restricted contexts.
        }
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.warn('[auth] disabled account sign-out failed; clearing local session', err);
        }
        forceLocalSignedOut();
        return;
      }

      setProfile((prof as Profile) ?? null);
      setRoles(nextRoles);
      setRolesError(null);
    } catch (err: unknown) {
      if (activeUserIdRef.current !== uid) return;
      console.error(`[auth] role load failed (attempt ${attempt + 1})`, err);
      if (attempt < MAX_ROLE_RETRIES) {
        const delay = 600 * Math.pow(2, attempt); // 600ms, 1.2s, 2.4s
        await new Promise((r) => setTimeout(r, delay));
        return loadProfileAndRoles(uid, attempt + 1);
      }
      setRolesError("We couldn't load your account. Please try again or contact support.");
    }
  };

  const retryRoles = async () => {
    if (!user) return;
    activeUserIdRef.current = user.id;
    setRolesError(null);
    setLoading(true);
    await loadProfileAndRoles(user.id);
    setLoading(false);
  };

  useEffect(() => {
    try {
      if (localStorage.getItem(AUTH_CACHE_FIX_KEY) !== '1') {
        clearLocalAuthArtifacts();
        localStorage.setItem(AUTH_CACHE_FIX_KEY, '1');
      }
    } catch {
      // Storage may be blocked; auth state will still be resolved by the SDK.
    }

    // Set up listener FIRST (per Supabase guidance), then fetch session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const nextUserId = newSession?.user?.id ?? null;
      activeUserIdRef.current = nextUserId;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setLoading(true);
        // Defer DB calls to avoid deadlocks inside the auth callback
        setTimeout(() => {
          const uid = newSession.user.id;
          loadProfileAndRoles(uid).finally(() => {
            if (activeUserIdRef.current === uid) setLoading(false);
          });
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        setRolesError(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      const nextUserId = s?.user?.id ?? null;
      activeUserIdRef.current = nextUserId;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const uid = s.user.id;
        loadProfileAndRoles(uid).finally(() => {
          if (activeUserIdRef.current === uid) setLoading(false);
        });
      }
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Update local state first so the root route cannot briefly redirect back
    // into the old role while the backend sign-out request is still in flight.
    resetAuthState();
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[auth] remote sign-out failed; clearing local session', err);
    } finally {
      forceLocalSignedOut();
    }
  };

  const refreshProfile = async () => {
    if (user) await loadProfileAndRoles(user.id);
  };

  const primaryRole: AppRole | null = roles.includes("admin")
    ? "admin"
    : roles.includes("instructor")
      ? "instructor"
      : roles.includes("student")
        ? "student"
        : null;

  return (
    <Ctx.Provider
      value={{ session, user, profile, roles, primaryRole, loading, rolesError, retryRoles, signOut, refreshProfile }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};

export const homeForRole = (role: AppRole | null): string => {
  switch (role) {
    case "admin":
      return "/admin";
    case "instructor":
      return "/instructor";
    case "student":
      return "/student";
    default:
      return "/auth/signin";
  }
};
