import { useAuth } from "@/contexts/AuthContext";
import { getCurrentUser as getDevUser } from "@/lib/messaging";

export type Identity = {
  id: string;
  name: string;
  role: "student" | "instructor" | "admin";
  photo?: string;
};

/**
 * Returns the active identity for messaging / notifications.
 * Prefers the real authenticated user; falls back to the dev role switcher
 * (only present in DEV builds) so prototype flows keep working.
 */
export const useIdentity = (): Identity | null => {
  const { user, profile, primaryRole } = useAuth();

  if (user && primaryRole) {
    return {
      id: user.id,
      name: profile?.display_name ?? user.email ?? "You",
      role: primaryRole,
      photo: profile?.photo_url ?? undefined,
    };
  }

  const dev = getDevUser();
  if (dev) return { id: dev.id, name: dev.name, role: dev.role };

  return null;
};
