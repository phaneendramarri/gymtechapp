import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

interface RequireGymFeatureProps {
  /** The feature key that must be enabled for this route (e.g. 'members', 'payments'). */
  requiredFeature: string;
  children: React.ReactNode;
}

/**
 * Feature-gating guard for gym-level feature flags.
 *
 * PLATFORM_ADMIN bypasses all feature gates so they can access any gym's
 * data regardless of the gym's plan. All other roles are subject to the
 * gym's enabledFeatures set.
 *
 * Usage: wrap feature-gated routes with this component, then wrap that
 * with ProtectedRoute for auth/role/permission checks.
 *
 *   <ProtectedRoute requiredPermissions={['members']}>
 *     <RequireGymFeature requiredFeature="members">
 *       <MembersPage />
 *     </RequireGymFeature>
 *   </ProtectedRoute>
 */
export const RequireGymFeature: React.FC<RequireGymFeatureProps> = ({
  requiredFeature,
  children,
}) => {
  const { user, gym, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs font-mono text-muted-foreground">Checking gym features…</p>
        </div>
      </div>
    );
  }

  const isPlatformAdmin = user?.role === 'PLATFORM_ADMIN';

  // Platform admins bypass feature gates entirely
  if (isPlatformAdmin) {
    return <>{children}</>;
  }

  // Regular users must have the feature enabled on their gym plan
  if (!gym?.enabledFeatures || !gym.enabledFeatures.includes(requiredFeature as any)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
