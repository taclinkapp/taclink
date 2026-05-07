import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AppRole, homeForRole } from "@/contexts/AuthContext";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { PolicyAcknowledgmentGate } from "@/components/PolicyAcknowledgmentGate";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
  requireRole?: AppRole;
  /** When true, render children even if the visitor isn't signed in (guest browse mode). */
  allowGuest?: boolean;
};

export const ProtectedRoute = ({ children, requireRole, allowGuest }: Props) => {
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
    if (allowGuest) return <>{children}</>;
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
            {/* Intentionally omit the raw error to avoid leaking schema details to end users. Full error is logged in the browser console. */}
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

  // Admins are allowed to view student/instructor routes for QA / validation.
  // We surface a small banner via <AdminViewAsBanner /> so it's obvious.
  const isAdmin = roles.includes("admin");

  if (requireRole && !roles.includes(requireRole) && !isAdmin) {
    const requestedPath = `${location.pathname}${location.search}`;
    console.warn("[auth] role route mismatch", {
      requestedPath,
      requiredRole: requireRole,
      roles,
      primaryRole,
    });
    return <Navigate to={homeForRole(primaryRole)} state={{ blockedFrom: requestedPath, requiredRole: requireRole }} replace />;
  }

  // Admins skip the acknowledgment gate so moderation/QA tooling stays accessible.
  if (requireRole === "admin" || isAdmin) {
    return (
      <>
        {isAdmin && requireRole && requireRole !== "admin" && (
          <AdminViewAsBanner role={requireRole} />
        )}
        {children}
      </>
    );
  }

  return <PolicyAcknowledgmentGate>{children}</PolicyAcknowledgmentGate>;
};

const AdminViewAsBanner = ({ role }: { role: AppRole }) => {
  return (
    <div className="sticky top-0 z-[60] w-full bg-primary text-primary-foreground text-xs font-bold px-3 py-2 flex items-center justify-between gap-3 shadow">
      <span className="uppercase tracking-wider truncate">
        Admin view · browsing as <span className="underline">{role}</span>
      </span>
      <a
        href="/admin"
        className="shrink-0 rounded-md bg-primary-foreground/15 hover:bg-primary-foreground/25 px-2 py-1 transition"
      >
        Exit to Admin
      </a>
    </div>
  );
};
