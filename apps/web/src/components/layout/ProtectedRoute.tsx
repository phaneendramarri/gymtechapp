import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
  allowMember?: boolean;
  /** Required permission keys — user must have ALL of them (AND logic). Owner bypasses all. */
  requiredPermissions?: string[];
  requiredFeature?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireSuperAdmin = false,
  allowMember = false,
  requiredPermissions,
  requiredFeature,
}) => {
  const { user, gym, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs font-mono text-muted-foreground">Authenticating session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Member role isolation: Member accounts can only access member portal
  if (user.role === 'MEMBER' && !allowMember) {
    return <Navigate to="/portal" replace />;
  }

  const isPlatformAdmin = user.role === 'PLATFORM_ADMIN' || (user.role as string) === 'SUPER_ADMIN';

  if (requireSuperAdmin && !isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!requireSuperAdmin && isPlatformAdmin) {
    return <Navigate to="/admin" replace />;
  }

  // Feature authorization guard — gates on gym plan features (e.g. PT disabled)
  if (requiredFeature && gym?.enabled_features && !gym.enabled_features.includes(requiredFeature as any)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Permission guard — owner (isOwner) bypasses all; otherwise all requiredPermissions must be present
  if (requiredPermissions && requiredPermissions.length > 0) {
    if (!user.isOwner) {
      const hasAll = requiredPermissions.every((perm) => user.permissions?.includes(perm));
      if (!hasAll) {
        return <Navigate to="/dashboard" replace />;
      }
    }
  }

  return <>{children}</>;
};
