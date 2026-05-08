import { useLocation } from "react-router-dom";
import { AIAssistant } from "./AIAssistant";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Decides whether to show the AI assistant and which role flavor to use,
 * based on the current route and the signed-in user's roles.
 */
export function AIAssistantMount() {
  const { pathname, search } = useLocation();
  const { roles } = useAuth();

  // Hide on auth, splash, admin, checkout/booking-success, and any onboarding flow
  const isOnboarding =
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/welcome") ||
    new URLSearchParams(search).get("onboarding") === "1";

  if (
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/admin") ||
    pathname.includes("/checkout") ||
    pathname.includes("/booking-success") ||
    isOnboarding
  ) {
    return null;
  }

  let role: "instructor" | "student" | null = null;
  if (pathname.startsWith("/instructor")) role = "instructor";
  else if (pathname.startsWith("/student")) role = "student";
  else if (roles.includes("instructor")) role = "instructor";
  else if (roles.includes("student")) role = "student";

  if (!role) return null;
  return <AIAssistant role={role} />;
}
