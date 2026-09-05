import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/motion/PageTransition';
import { ThemeProvider } from './lib/theme';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './components/ui/toast';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { RequireGymFeature } from './components/layout/RequireGymFeature';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { ErrorBoundary } from './components/layout/ErrorBoundary';

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
const CommunicationsPage = lazy(() => import('./pages/CommunicationsPage').then(m => ({ default: m.CommunicationsPage })));
const RolesManagementPage = lazy(() => import('./pages/platform/RolesManagementPage').then(m => ({ default: m.RolesManagementPage })));
const MenuManagementPage = lazy(() => import('./pages/platform/MenuManagementPage').then(m => ({ default: m.MenuManagementPage })));
const PlatformUsersPage = lazy(() => import('./pages/platform/PlatformUsersPage').then(m => ({ default: m.PlatformUsersPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then(m => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('./pages/ContactPage').then(m => ({ default: m.ContactPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));

// M-11: Wrap lazy-loaded page components with ErrorBoundary so crashes in one
// page don't take down the entire app.
const withErrorBoundary = (page: React.ComponentType): React.ComponentType =>
  () => (
    <ErrorBoundary>
      {React.createElement(page)}
    </ErrorBoundary>
  );

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

const AppRoutes: React.FC = () => {
  const location = useLocation();
  return (
    <Suspense fallback={<RouteSkeleton />}>
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname.split('/')[1] || 'root'}>
          {/* Public Routes — loaded immediately */}
          <Route path="/" element={<PageTransition><LandingPage /></PageTransition>} />
          <Route path="/login" element={<PageTransition><LoginPage /></PageTransition>} />
          <Route path="/reset-password" element={<PageTransition><ResetPasswordPage /></PageTransition>} />

                  {/* Gym Owner & Staff Routes — lazy loaded */}
                  <Route
                    path="/dashboard"
                    element={
                      <PageTransition>
                        <ProtectedRoute>
                          <RequireGymFeature requiredFeature="dashboard">
                            <ErrorBoundary><DashboardPage /></ErrorBoundary>
                          </RequireGymFeature>
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/members"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredPermissions={['members']}>
                          <RequireGymFeature requiredFeature="members">
                            <ErrorBoundary><MembersPage /></ErrorBoundary>
                          </RequireGymFeature>
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/members/new"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredPermissions={['members']}>
                          <RequireGymFeature requiredFeature="members">
                            <ErrorBoundary><NewMemberPage /></ErrorBoundary>
                          </RequireGymFeature>
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/members/:id"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredPermissions={['members']}>
                          <RequireGymFeature requiredFeature="members">
                            <ErrorBoundary><MemberDetailPage /></ErrorBoundary>
                          </RequireGymFeature>
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/members/:id/renew"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredPermissions={['members']}>
                          <RequireGymFeature requiredFeature="members">
                            <ErrorBoundary><RenewMemberPage /></ErrorBoundary>
                          </RequireGymFeature>
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/payments"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredPermissions={['payments']}>
                          <RequireGymFeature requiredFeature="payments">
                            <ErrorBoundary><PaymentsPage /></ErrorBoundary>
                          </RequireGymFeature>
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/pt-collections"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredPermissions={['pt_collections']}>
                          <RequireGymFeature requiredFeature="pt_collections">
                            <ErrorBoundary><PtCollectionsPage /></ErrorBoundary>
                          </RequireGymFeature>
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/attendance"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredPermissions={['attendance']}>
                          <RequireGymFeature requiredFeature="attendance">
                            <ErrorBoundary><AttendancePage /></ErrorBoundary>
                          </RequireGymFeature>
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/plans"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredPermissions={['plans']}>
                          <RequireGymFeature requiredFeature="plans">
                            <ErrorBoundary><PlansPage /></ErrorBoundary>
                          </RequireGymFeature>
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/staff"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredPermissions={['staff']}>
                          <RequireGymFeature requiredFeature="staff">
                            <ErrorBoundary><StaffPage /></ErrorBoundary>
                          </RequireGymFeature>
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/reports"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredPermissions={['reports']}>
                          <RequireGymFeature requiredFeature="reports">
                            <ErrorBoundary><ReportsPage /></ErrorBoundary>
                          </RequireGymFeature>
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/settings/notifications"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredPermissions={['settings']}>
                          <RequireGymFeature requiredFeature="settings">
                            <ErrorBoundary><SettingsNotificationsPage /></ErrorBoundary>
                          </RequireGymFeature>
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/audit-logs"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredPermissions={['audit_logs']}>
                          <ErrorBoundary><AuditLogsPage /></ErrorBoundary>
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/communications"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredPermissions={['settings']}>
                          <ErrorBoundary><CommunicationsPage /></ErrorBoundary>
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />

                  {/* Platform Super Admin Routes */}
                  <Route
                    path="/platform/roles"
                    element={
                      <PageTransition>
                        <ProtectedRoute requireSuperAdmin={true}>
                          <ErrorBoundary><RolesManagementPage /></ErrorBoundary>
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/platform/menus"
                    element={
                      <PageTransition>
                        <ProtectedRoute requireSuperAdmin={true}>
                          <ErrorBoundary><MenuManagementPage /></ErrorBoundary>
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/platform/users"
                    element={
                      <PageTransition>
                        <ProtectedRoute requireSuperAdmin={true}>
                          <ErrorBoundary><PlatformUsersPage /></ErrorBoundary>
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />

                  {/* Platform Super Admin Route */}
                  <Route
                    path="/admin"
                    element={
                      <PageTransition>
                        <ProtectedRoute requireSuperAdmin={true}>
                          <AdminPage />
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />

                  {/* Member Self-Service Portal Route */}
                  <Route
                    path="/portal"
                    element={
                      <PageTransition>
                        <ProtectedRoute allowMember={true}>
                          <MemberPortalPage />
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />

                  {/* Static Pages */}
                  <Route
                    path="/about"
                    element={
                      <PageTransition>
                        <AboutPage />
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/contact"
                    element={
                      <PageTransition>
                        <ContactPage />
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/terms"
                    element={
                      <PageTransition>
                        <TermsPage />
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/privacy"
                    element={
                      <PageTransition>
                        <PrivacyPage />
                      </PageTransition>
                    }
                  />

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AnimatePresence>
            </Suspense>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
