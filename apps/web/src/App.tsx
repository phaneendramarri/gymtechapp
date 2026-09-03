import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';

// Smooth page-transition wrapper — wraps every route's content element.
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
  >
    {children}
  </motion.div>
);
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
const AboutPage = lazy(() => import('./pages/AboutPage').then(m => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('./pages/ContactPage').then(m => ({ default: m.ContactPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));

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
                        <ProtectedRoute requiredFeature="dashboard">
                          <DashboardPage />
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/members"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredFeature="members" requiredPermissions={['members']}>
                          <MembersPage />
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/members/new"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredFeature="members" requiredPermissions={['members']}>
                          <NewMemberPage />
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/members/:id"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredFeature="members" requiredPermissions={['members']}>
                          <MemberDetailPage />
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/members/:id/renew"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredFeature="members" requiredPermissions={['members']}>
                          <RenewMemberPage />
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/payments"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredFeature="payments" requiredPermissions={['payments']}>
                          <PaymentsPage />
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/pt-collections"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredFeature="pt_collections" requiredPermissions={['pt_collections']}>
                          <PtCollectionsPage />
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/attendance"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredFeature="attendance" requiredPermissions={['attendance']}>
                          <AttendancePage />
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/plans"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredFeature="plans" requiredPermissions={['plans']}>
                          <PlansPage />
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/staff"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredFeature="staff" requiredPermissions={['staff']}>
                          <StaffPage />
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/reports"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredFeature="reports" requiredPermissions={['reports']}>
                          <ReportsPage />
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/settings/notifications"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredFeature="settings" requiredPermissions={['settings']}>
                          <SettingsNotificationsPage />
                        </ProtectedRoute>
                      </PageTransition>
                    }
                  />
                  <Route
                    path="/audit-logs"
                    element={
                      <PageTransition>
                        <ProtectedRoute requiredPermissions={['audit_logs']}>
                          <AuditLogsPage />
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
          </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
