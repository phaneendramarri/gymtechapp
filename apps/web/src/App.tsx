import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PageTransition } from '@/components/motion/PageTransition';
import { ThemeProvider } from './lib/theme';
import { AuthProvider } from './lib/auth';
import { GymFeatureKey } from '@gymtech/shared';
import { RouteSplash } from './components/layout/RouteSplash';
import { ToastProvider } from './components/ui/toast';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { ErrorBoundary } from './components/layout/ErrorBoundary';

// Lazy-loaded pages — each becomes a separate chunk, loaded on demand.
const DashboardPage       = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const MembersPage         = lazy(() => import('./pages/MembersPage').then(m => ({ default: m.MembersPage })));
const NewMemberPage       = lazy(() => import('./pages/NewMemberPage').then(m => ({ default: m.NewMemberPage })));
const MemberDetailPage    = lazy(() => import('./pages/MemberDetailPage').then(m => ({ default: m.MemberDetailPage })));
const RenewMemberPage     = lazy(() => import('./pages/RenewMemberPage').then(m => ({ default: m.RenewMemberPage })));
const PaymentsPage        = lazy(() => import('./pages/PaymentsPage').then(m => ({ default: m.PaymentsPage })));
const AttendancePage      = lazy(() => import('./pages/AttendancePage').then(m => ({ default: m.AttendancePage })));
const PlansPage           = lazy(() => import('./pages/PlansPage').then(m => ({ default: m.PlansPage })));
const StaffPage           = lazy(() => import('./pages/StaffPage').then(m => ({ default: m.StaffPage })));
const ReportsPage         = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SettingsPage        = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AdminPage           = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const ResetPasswordPage   = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const MemberPortalPage    = lazy(() => import('./pages/MemberPortalPage').then(m => ({ default: m.MemberPortalPage })));
const PtCollectionsPage   = lazy(() => import('./pages/PtCollectionsPage').then(m => ({ default: m.PtCollectionsPage })));
const ClassesPage         = lazy(() => import('./pages/ClassesPage').then(m => ({ default: m.ClassesPage })));
const PosPage             = lazy(() => import('./pages/PosPage').then(m => ({ default: m.PosPage })));
const ExpensesPage        = lazy(() => import('./pages/ExpensesPage').then(m => ({ default: m.ExpensesPage })));
const LockersPage         = lazy(() => import('./pages/LockersPage').then(m => ({ default: m.LockersPage })));
const KioskPage           = lazy(() => import('./pages/KioskPage').then(m => ({ default: m.KioskPage })));
const AuditLogsPage       = lazy(() => import('./pages/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const RolesManagementPage = lazy(() => import('./pages/platform/RolesManagementPage').then(m => ({ default: m.RolesManagementPage })));
const PlatformUsersPage   = lazy(() => import('./pages/platform/PlatformUsersPage').then(m => ({ default: m.PlatformUsersPage })));

// Branded route-loading state — shown while a lazy page chunk loads so
// navigation never flashes a blank page.
const RouteSkeleton: React.FC = () => (
  <div className="min-h-screen">
    <RouteSplash message="Loading…" className="min-h-screen" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
});

/** Wraps a page in ProtectedRoute + ErrorBoundary — the standard authenticated route. */
function Guarded({
  children,
  permissions,
  feature,
  superAdmin,
  member,
}: {
  children: React.ReactNode;
  permissions?: string[];
  feature?: GymFeatureKey;
  superAdmin?: boolean;
  member?: boolean;
}) {
  return (
    <ProtectedRoute
      requiredPermissions={permissions}
      feature={feature}
      requireSuperAdmin={superAdmin}
      allowMember={member}
    >
      <ErrorBoundary>{children}</ErrorBoundary>
    </ProtectedRoute>
  );
}

const AppRoutes: React.FC = () => {
  const location = useLocation();

  return (
    <Suspense fallback={<RouteSkeleton />}>
      {/*
        No outer AnimatePresence here on purpose: PageTransition already
        animates each page enter, and mode="wait" on two nested presences
        left a blank gap on every navigation (exit must finish before the
        next page even starts mounting). Single enter animation = no blank.
      */}
      <Routes location={location} key={location.pathname.split('/')[1] || 'root'}>

          <Route path="/" element={<Navigate to="/login" replace />} />

          <Route path="/login"          element={<PageTransition><LoginPage /></PageTransition>} />
          <Route path="/reset-password" element={<PageTransition><ResetPasswordPage /></PageTransition>} />

          <Route path="/dashboard"              element={<PageTransition><Guarded><DashboardPage /></Guarded></PageTransition>} />
          <Route path="/members"                element={<PageTransition><Guarded permissions={['members']}><MembersPage /></Guarded></PageTransition>} />
          <Route path="/members/new"            element={<PageTransition><Guarded permissions={['members']}><NewMemberPage /></Guarded></PageTransition>} />
          <Route path="/members/:id"            element={<PageTransition><Guarded permissions={['members']}><MemberDetailPage /></Guarded></PageTransition>} />
          <Route path="/members/:id/renew"      element={<PageTransition><Guarded permissions={['members']}><RenewMemberPage /></Guarded></PageTransition>} />
          <Route path="/payments"               element={<PageTransition><Guarded permissions={['payments']}><PaymentsPage /></Guarded></PageTransition>} />
          <Route path="/pt-collections"         element={<PageTransition><Guarded permissions={['pt_collections']}><PtCollectionsPage /></Guarded></PageTransition>} />
          <Route path="/attendance"             element={<PageTransition><Guarded permissions={['attendance']}><AttendancePage /></Guarded></PageTransition>} />
          <Route path="/kiosk"                  element={<PageTransition><Guarded permissions={['attendance']}><KioskPage /></Guarded></PageTransition>} />
          <Route path="/classes"                element={<PageTransition><Guarded permissions={['classes']} feature="classes"><ClassesPage /></Guarded></PageTransition>} />
          <Route path="/pos"                    element={<PageTransition><Guarded permissions={['pos']} feature="pos"><PosPage /></Guarded></PageTransition>} />
          <Route path="/expenses"               element={<PageTransition><Guarded permissions={['expenses']} feature="expenses"><ExpensesPage /></Guarded></PageTransition>} />
          <Route path="/lockers"                element={<PageTransition><Guarded permissions={['lockers']} feature="lockers"><LockersPage /></Guarded></PageTransition>} />
          <Route path="/plans"                  element={<PageTransition><Guarded permissions={['plans']}><PlansPage /></Guarded></PageTransition>} />
          <Route path="/staff"                  element={<PageTransition><Guarded permissions={['staff']}><StaffPage /></Guarded></PageTransition>} />
          <Route path="/reports"                element={<PageTransition><Guarded permissions={['reports']}><ReportsPage /></Guarded></PageTransition>} />
          <Route path="/settings"               element={<PageTransition><Guarded permissions={['settings']}><SettingsPage /></Guarded></PageTransition>} />
          <Route path="/settings/notifications" element={<PageTransition><Guarded permissions={['settings']}><SettingsPage defaultTab="notifications" /></Guarded></PageTransition>} />
          <Route path="/audit-logs"             element={<PageTransition><Guarded permissions={['audit_logs']} feature="audit_logs"><AuditLogsPage /></Guarded></PageTransition>} />

          <Route path="/portal" element={<PageTransition><Guarded member><MemberPortalPage /></Guarded></PageTransition>} />

          <Route path="/admin"          element={<PageTransition><Guarded superAdmin><AdminPage /></Guarded></PageTransition>} />
          <Route path="/platform/roles" element={<PageTransition><Guarded superAdmin><RolesManagementPage /></Guarded></PageTransition>} />
          <Route path="/platform/users" element={<PageTransition><Guarded superAdmin><PlatformUsersPage /></Guarded></PageTransition>} />

          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
    </Suspense>
  );
};

export const App: React.FC = () => (
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

export default App;
