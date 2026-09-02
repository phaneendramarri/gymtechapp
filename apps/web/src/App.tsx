import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './lib/theme';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './components/ui/toast';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';

// Lazy-loaded pages — each becomes a separate chunk, loaded on demand.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const MembersPage = lazy(() => import('./pages/MembersPage').then(m => ({ default: m.MembersPage })));
const NewMemberPage = lazy(() => import('./pages/NewMemberPage').then(m => ({ default: m.NewMemberPage })));
const MemberDetailPage = lazy(() => import('./pages/MemberDetailPage').then(m => ({ default: m.MemberDetailPage })));
const RenewMemberPage = lazy(() => import('./pages/RenewMemberPage').then(m => ({ default: m.RenewMemberPage })));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage').then(m => ({ default: m.PaymentsPage })));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then(m => ({ default: m.AttendancePage })));
const PlansPage = lazy(() => import('./pages/PlansPage').then(m => ({ default: m.PlansPage })));
const StaffPage = lazy(() => import('./pages/StaffPage').then(m => ({ default: m.StaffPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SettingsNotificationsPage = lazy(() => import('./pages/SettingsNotificationsPage').then(m => ({ default: m.SettingsNotificationsPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const MemberPortalPage = lazy(() => import('./pages/MemberPortalPage').then(m => ({ default: m.MemberPortalPage })));
const PtCollectionsPage = lazy(() => import('./pages/PtCollectionsPage').then(m => ({ default: m.PtCollectionsPage })));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));

// Minimal route-loading skeleton — avoids layout shift vs a full-page spinner.
const RouteSkeleton: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-(--bg)">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-(--iron) border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-(--ink-3)">Loading...</span>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2, // 2 minutes
      // Phase 5.1: Global query error handler — retry once, then surface error to component
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteSkeleton />}>
              <Routes>
                {/* Public Routes — loaded immediately */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Gym Owner & Staff Routes — lazy loaded */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute requiredFeature="dashboard">
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/members"
                  element={
                    <ProtectedRoute requiredFeature="members" allowedRoles={['OWNER', 'MANAGER', 'STAFF']}>
                      <MembersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/members/new"
                  element={
                    <ProtectedRoute requiredFeature="members" allowedRoles={['OWNER', 'MANAGER', 'STAFF']}>
                      <NewMemberPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/members/:id"
                  element={
                    <ProtectedRoute requiredFeature="members" allowedRoles={['OWNER', 'MANAGER', 'STAFF', 'TRAINER']}>
                      <MemberDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/members/:id/renew"
                  element={
                    <ProtectedRoute requiredFeature="members" allowedRoles={['OWNER', 'MANAGER', 'STAFF']}>
                      <RenewMemberPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/payments"
                  element={
                    <ProtectedRoute requiredFeature="payments" allowedRoles={['OWNER', 'MANAGER', 'STAFF']}>
                      <PaymentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pt-collections"
                  element={
                    <ProtectedRoute requiredFeature="pt_collections" allowedRoles={['OWNER', 'MANAGER', 'TRAINER']}>
                      <PtCollectionsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/attendance"
                  element={
                    <ProtectedRoute requiredFeature="attendance" allowedRoles={['OWNER', 'MANAGER', 'STAFF', 'TRAINER']}>
                      <AttendancePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/plans"
                  element={
                    <ProtectedRoute requiredFeature="plans" allowedRoles={['OWNER', 'MANAGER']}>
                      <PlansPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/staff"
                  element={
                    <ProtectedRoute requiredFeature="staff" allowedRoles={['OWNER']}>
                      <StaffPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute requiredFeature="reports" allowedRoles={['OWNER']}>
                      <ReportsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings/notifications"
                  element={
                    <ProtectedRoute requiredFeature="settings" allowedRoles={['OWNER']}>
                      <SettingsNotificationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/audit-logs"
                  element={
                    <ProtectedRoute allowedRoles={['OWNER']}>
                      <AuditLogsPage />
                    </ProtectedRoute>
                  }
                />

                {/* Platform Super Admin Route */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireSuperAdmin={true}>
                      <AdminPage />
                    </ProtectedRoute>
                  }
                />

                {/* Member Self-Service Portal Route */}
                <Route
                  path="/portal"
                  element={
                    <ProtectedRoute allowMember={true}>
                      <MemberPortalPage />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
