import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
  account_status?: 'active' | 'warned' | 'suspended' | string | null;
  strike_points?: number | null;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfileAndRoles = async (uid: string) => {
    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((prof as Profile) ?? null);
    setRoles(((roleRows as { role: AppRole }[]) ?? []).map((r) => r.role));
  };

  useEffect(() => {
    // Set up listener FIRST (per Supabase guidance), then fetch session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer DB calls to avoid deadlocks inside the auth callback
        setTimeout(() => loadProfileAndRoles(newSession.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfileAndRoles(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
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
      value={{ session, user, profile, roles, primaryRole, loading, signOut, refreshProfile }}
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
