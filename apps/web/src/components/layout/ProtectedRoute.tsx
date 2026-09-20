import React from 'react';
import { Navigate } from 'react-router-dom';
import { GymFeatureKey } from '@gymtech/shared';
import { useAuth } from '@/lib/auth';
import { RouteSplash } from './RouteSplash';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
  allowMember?: boolean;
  /** Required permission keys — user must have ALL of them (AND logic). Owner bypasses all. */
  requiredPermissions?: string[];
  /**
   * License feature key — mirrors the backend `requireFeature` gate.
   * Applies to owners too (only platform admins bypass); redirects to
   * /dashboard when the gym's license has the module disabled.
   */
  feature?: GymFeatureKey;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireSuperAdmin = false,
  allowMember = false,
  requiredPermissions,
  feature,
}) => {
  const { user, isLoading, hasFeature } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <RouteSplash message="Checking your session…" className="min-h-screen" />
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

  // License feature gate — mirrors backend `requireFeature`. Owners are
  // gated too; only platform admins bypass. Empty array means no features enabled.
  if (feature && !isPlatformAdmin && !hasFeature(feature)) {
    return <Navigate to={feature === 'dashboard' ? '/members' : '/dashboard'} replace />;
  }

  // Permission guard — PLATFORM_ADMIN and gym OWNER bypass all permission checks so they have
  // full access across every gym module (members, payments, etc.)
  const isOwner = user.role === 'OWNER' || Boolean(user.isOwner);
  if (requiredPermissions && requiredPermissions.length > 0 && !isPlatformAdmin && !isOwner) {
    const hasAll = requiredPermissions.every((perm) => user.permissions?.includes(perm));
    if (!hasAll) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};
