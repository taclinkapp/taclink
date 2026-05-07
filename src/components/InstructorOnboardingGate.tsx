import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Status = {
  complete: boolean;
  next_step: "subscription" | "credential" | "policy" | "complete";
};

const ALLOWED_WHEN_INCOMPLETE = [
  "/instructor/subscription",
  "/auth/credential-verification",
  "/instructor/credentials",
];

const NEXT_PATH: Record<Status["next_step"], string> = {
  subscription: "/instructor/subscription?onboarding=1",
  credential: "/auth/credential-verification",
  policy: "/instructor/subscription?onboarding=1", // policy ack gate handles it
  complete: "/instructor",
};

/**
 * Forces an instructor to finish all onboarding steps (subscription chosen,
 * a credential uploaded, and the platform policy acknowledged) before they
 * can use any other instructor route.
 */
export const InstructorOnboardingGate = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .rpc("instructor_onboarding_status", { _user_id: user.id })
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // Fail open so a transient error doesn't soft-lock instructors.
        console.error("instructor_onboarding_status failed", error);
        setStatus({ complete: true, next_step: "complete" });
      } else {
        setStatus({
          complete: !!data?.complete,
          next_step: (data?.next_step as Status["next_step"]) ?? "subscription",
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (status && !status.complete) {
    const allowed = ALLOWED_WHEN_INCOMPLETE.some((p) => pathname.startsWith(p));
    if (!allowed) {
      return <Navigate to={NEXT_PATH[status.next_step]} replace />;
    }
  }

  return <>{children}</>;
};
