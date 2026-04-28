import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AppRole, homeForRole } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

type Props = {
  children: ReactNode;
  requireRole?: AppRole;
};

export const ProtectedRoute = ({ children, requireRole }: Props) => {
  const { user, primaryRole, roles, loading } = useAuth();
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

  if (requireRole && !roles.includes(requireRole)) {
    return <Navigate to={homeForRole(primaryRole)} replace />;
  }

  return <>{children}</>;
};
