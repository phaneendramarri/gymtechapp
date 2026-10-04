import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { GymFeatureKey } from '@gymtech/shared';
import { useAuth } from '@/lib/auth';
import { RouteSplash } from './RouteSplash';
import { ErrorState } from '@/components/shared/ErrorState';

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
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <RouteSplash message="Checking your session…" className="min-h-screen" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Member role isolation: Member accounts can only access member portal
  if (user.role === 'MEMBER' && !allowMember) {
    return <Navigate to="/portal" replace />;
  }

  const isPlatformAdmin = user.role === 'PLATFORM_ADMIN' || (user.role as string) === 'SUPER_ADMIN';

  if (requireSuperAdmin && !isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Platform admin role isolation: Platform admins manage SaaS tenants and platform governance
  // (/admin, /platform/*) with no local gym context. Bounce to /admin if accessing gym desk routes.
  if (isPlatformAdmin && !requireSuperAdmin && !allowMember) {
    return <Navigate to="/admin" replace />;
  }

  // Member-only routes (currently just /portal): staff sessions landing here
  // previously called the member API, got 401, and were logged out. Bounce
  // non-members back to the dashboard instead.
  if (
    allowMember &&
    !requireSuperAdmin &&
    !requiredPermissions?.length &&
    !feature &&
    user.role !== 'MEMBER' &&
    !isPlatformAdmin
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  // License feature gate — mirrors backend `requireFeature`. Owners are
  // gated too; only platform admins bypass. Empty array means no features enabled.
  if (feature && !isPlatformAdmin && !hasFeature(feature)) {
    const fallback = feature === 'dashboard' ? '/members' : '/dashboard';
    // Loop-proofing: if the fallback is the page we're already on (e.g.
    // both modules disabled), render an explanatory state instead of
    // ping-ponging <Navigate> forever.
    if (fallback === location.pathname) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full">
            <ErrorState
              title="Module unavailable"
              description="This module is disabled for your gym's plan. Please contact your administrator."
              backHref="/login"
              backLabel="Sign in"
            />
          </div>
        </div>
      );
    }
    return <Navigate to={fallback} replace />;
  }

  // Permission guard — PLATFORM_ADMIN and gym OWNER bypass all permission checks so they have
  // full access across every gym module (members, payments, etc.)
  const isOwner = user.role === 'OWNER' || Boolean(user.isOwner);
  if (requiredPermissions?.length && !isPlatformAdmin && !isOwner) {
    const hasAll = requiredPermissions.every((perm) => user.permissions?.includes(perm));
    if (!hasAll) {
      if (location.pathname === '/dashboard') {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md w-full">
              <ErrorState
                title="No access"
                description="Your account doesn't have permission to access any module. Please contact your administrator."
                backHref="/login"
                backLabel="Sign in"
              />
            </div>
          </div>
        );
      }
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};
