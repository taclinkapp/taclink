import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AppRole, homeForRole } from "@/contexts/AuthContext";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { PolicyAcknowledgmentGate } from "@/components/PolicyAcknowledgmentGate";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
  requireRole?: AppRole;
};

export const ProtectedRoute = ({ children, requireRole }: Props) => {
  const { user, primaryRole, roles, loading, rolesError, retryRoles, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/signin" state={{ from: location.pathname }} replace />;
  }

  // If role lookup failed, show a friendly retry surface instead of bouncing
  // the user away from the page they were trying to reach.
  if (rolesError) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6">
        <div className="max-w-sm w-full neu p-6 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 grid place-items-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-bold">We couldn’t load your account</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your sign-in succeeded, but we hit a hiccup loading your role. You won’t lose your spot — try again.
            </p>
            <p className="text-[11px] text-muted-foreground/80 mt-2 font-mono break-all">{rolesError}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={retryRoles} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
            <Button variant="ghost" onClick={signOut} className="w-full">
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (requireRole && !roles.includes(requireRole)) {
    const requestedPath = `${location.pathname}${location.search}`;
    console.warn("[auth] role route mismatch", {
      requestedPath,
      requiredRole: requireRole,
      roles,
      primaryRole,
    });
    return <Navigate to={homeForRole(primaryRole)} state={{ blockedFrom: requestedPath, requiredRole }} replace />;
  }

  // Admins skip the acknowledgment gate so moderation tooling stays accessible.
  if (requireRole === "admin" || roles.includes("admin")) {
    return <>{children}</>;
  }

  return <PolicyAcknowledgmentGate>{children}</PolicyAcknowledgmentGate>;
};
