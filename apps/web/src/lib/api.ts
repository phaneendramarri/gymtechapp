import {
  LoginRequest,
  LoginResponse,
  MeResponse,
  CreateMemberRequest,
  CreateMemberResponse,
  UpdateMemberRequest,
  MemberDetailResponse,
  RenewMembershipRequest,
  RenewMembershipResponse,
  CreatePlanRequest,
  RecordPaymentRequest,
  RecordPaymentResponse,
  CheckInRequest,
  CheckInResponse,
  CreateStaffRequest,
  CreateGymRequest,
  DashboardMetrics,
  GymMembershipPlan,
  User,
  Member,
  Payment,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  BulkImportMembersRequest,
  BulkImportMembersResponse,
  MemberLoginRequest,
  MemberLoginResponse,
  FreezeMemberResponse,
  RecordPtCollectionRequest,
  RecordPtCollectionResponse,
  PtCollectionRow,
  PtSummary,
  InvoiceData,
  CommunicationLogsListResponse,
  NotificationSettingsRequest,
  NotificationSettingsResponse,
  TestSmtpRequest,
  PlatformCommunicationsConfig,
  SendNotificationRequest,
  MenuNode,
} from '@gymtech/shared';

// The Hono API is served from the same origin as the SPA (single Cloudflare
// Worker). Leave the base empty so all `/api/*` calls go to the same host.
// In dev, Vite's proxy or `wrangler dev` handles the routing. Override via
// `VITE_API_BASE_URL` only when explicitly needed.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * The session JWT is in an httpOnly cookie that the browser auto-attaches.
 * We no longer read it from localStorage. (Phase 1.2 of the security
 * hardening plan — moves tokens out of XSS-reachable storage.)
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Read the `gym_csrf` non-httpOnly cookie value. Used for the
 * double-submit CSRF pattern: the web app reads the cookie and echoes it
 * as the `X-CSRF-Token` header on every non-safe request.
 */
function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)gym_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * H-16: Token refresh interceptor
 * Stores refresh token in sessionStorage (more isolated than localStorage).
 * On 401, attempts sliding-window refresh, retries original request once,
 * then redirects to login only if refresh fails.
 */
const REFRESH_TOKEN_KEY = 'gymtech_refresh_token';
// Shared promise dedupes concurrent refresh attempts while one is in-flight
let _refreshPromise: Promise<string | null> | null = null;

function getStoredRefreshToken(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

function setStoredRefreshToken(token: string | null): void {
  if (typeof sessionStorage === 'undefined') return;
  if (token) sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
  else sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const method = (options.method || 'GET').toUpperCase();
  if (!SAFE_METHODS.has(method)) {
    const csrf = readCsrfCookie();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  const doFetch = () =>
    fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

  let res = await doFetch();

  // H-16: On 401, attempt token refresh then retry original request once
  if (res.status === 401) {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      // Reuse in-flight refresh if another request triggered it concurrently
      if (!_refreshPromise) {
        _refreshPromise = this.tryRefresh(refreshToken);
      }
      const newToken = await _refreshPromise;
      _refreshPromise = null;
      if (newToken) {
        // Retry once with updated CSRF (cookie may have changed too)
        if (!SAFE_METHODS.has(method)) {
          const csrf = readCsrfCookie();
          if (csrf) headers['X-CSRF-Token'] = csrf;
        }
        res = await doFetch();
      }
    }

    // If still 401 or no refresh token → redirect to login
    if (res.status === 401) {
      setStoredRefreshToken(null);
      if (!window.location.hash.includes('/login') && window.location.hash !== '' && window.location.hash !== '#/') {
        window.location.hash = '#/login';
      }
    }
  }

  const data: any = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
    Object.assign(error, data);
    throw error;
  }

  return data as T;
}

  // H-16: Sliding-window refresh — returns new access token or null on failure.
  // Uses the stored refresh token from sessionStorage; on success the new refresh
  // token is saved back to sessionStorage for the next cycle.
  private async tryRefresh(refreshToken: string): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const data: any = await res.json().catch(() => ({}));
      if (!data.token) return null;
      if (data.refreshToken) setStoredRefreshToken(data.refreshToken);
      return data.token as string;
    } catch {
      return null;
    }
  }

  // Auth
  async login(payload: LoginRequest): Promise<LoginResponse> {
    // Bypass the refresh interceptor on login — store refresh token from response.
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    // H-16: Persist refresh token for token-refresh interceptor
    if (data.refreshToken) setStoredRefreshToken(data.refreshToken);
    return data as LoginResponse;
  }

  async getMe(): Promise<MeResponse> {
    return this.request<MeResponse>('/api/auth/me');
  }

  // Menu — fetched from DB, filtered by user permissions
  async getMenu(): Promise<{ menu: MenuNode[] }> {
    return this.request<{ menu: MenuNode[] }>('/api/menu');
  }

  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    return this.request<ForgotPasswordResponse>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async logout(): Promise<{ success: boolean }> {
    // Bypass interceptor — clear stored refresh token then hit logout
    setStoredRefreshToken(null);
    const res = await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data as { success: boolean };
  }

  async resetPassword(payload: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    return this.request<ResetPasswordResponse>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async memberLogin(payload: MemberLoginRequest): Promise<MemberLoginResponse> {
    return this.request<MemberLoginResponse>('/api/auth/member-login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getMemberPortalData(): Promise<{
    member: Member;
    activeMembership?: any;
    memberships: any[];
    payments: Payment[];
    attendance: any[];
    gym: { name: string; address?: string; phone?: string };
  }> {
    return this.request('/api/auth/portal');
  }

  // Dashboard
  async getDashboard(): Promise<DashboardMetrics> {
    return this.request<DashboardMetrics>('/api/dashboard');
  }

  // Members
  // ---------- Gym-scoped helpers (platform-admin cross-gym support) ----------
  /**
   * Build a gymId-aware query string. When gymId is omitted the backend falls
   * back to the session's JWT gymId (regular gym users). When gymId is
   * provided (platform admin) the ?gymId= param is forwarded to requireGym.
   */
  gymParams(gymId?: number, extra?: Record<string, string | number | undefined>): URLSearchParams {
    const q = new URLSearchParams();
    if (gymId) q.set('gymId', String(gymId));
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if (v !== undefined) q.set(k, String(v));
      }
    }
    return q;
  }

  // Members
  async getMembers(params?: { search?: string; status?: string; limit?: number; offset?: number }, gymId?: number): Promise<{ members: any[] }> {
    const q = this.gymParams(gymId);
    if (params?.search) q.set('search', params.search);
    if (params?.status && params.status !== 'ALL') q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));

    const qs = q.toString();
    return this.request<{ members: any[] }>(`/api/members${qs ? `?${qs}` : ''}`);
  }

  // L8: Single-query summary counts (avoids double-fetch)
  async getMembersSummary(): Promise<{ counts: { total: number; active: number; expiring: number; frozen: number; blocked: number; expired: number } }> {
    const q = this.gymParams();
    q.set('summary', 'true');
    return this.request<{ counts: { total: number; active: number; expiring: number; frozen: number; blocked: number; expired: number } }>(`/api/members?${q.toString()}`);
  }

  async createMember(payload: CreateMemberRequest, gymId?: number): Promise<CreateMemberResponse> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<CreateMemberResponse>(`/api/members${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async bulkImportMembers(payload: BulkImportMembersRequest, gymId?: number): Promise<BulkImportMembersResponse> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<BulkImportMembersResponse>(`/api/members/bulk-import${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getMemberDetail(id: number, gymId?: number): Promise<MemberDetailResponse> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<MemberDetailResponse>(`/api/members/${id}${qs ? `?${qs}` : ''}`);
  }

  async updateMember(id: number, payload: UpdateMemberRequest, gymId?: number): Promise<Member> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<Member>(`/api/members/${id}${qs ? `?${qs}` : ''}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async renewMembership(id: number, payload: RenewMembershipRequest, gymId?: number): Promise<RenewMembershipResponse> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<RenewMembershipResponse>(`/api/members/${id}/renew${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async freezeMember(id: number, reason?: string, gymId?: number): Promise<FreezeMemberResponse> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<FreezeMemberResponse>(`/api/members/${id}/freeze${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async unfreezeMember(id: number, gymId?: number): Promise<FreezeMemberResponse> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<FreezeMemberResponse>(`/api/members/${id}/unfreeze${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // Plans
  async getPlans(gymId?: number): Promise<{ plans: GymMembershipPlan[] }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ plans: GymMembershipPlan[] }>(`/api/plans${qs ? `?${qs}` : ''}`);
  }

  async createPlan(payload: CreatePlanRequest, gymId?: number): Promise<GymMembershipPlan> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<GymMembershipPlan>(`/api/plans${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Payments
  async getPayments(params?: { limit?: number; memberId?: string }, gymId?: number): Promise<{ payments: Payment[]; summary: any }> {
    const q = this.gymParams(gymId);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.memberId) q.set('memberId', params.memberId);
    const qs = q.toString();
    return this.request<{ payments: Payment[]; summary: any }>(`/api/payments${qs ? `?${qs}` : ''}`);
  }

  async getCommunicationLogs(params?: { channel?: string; limit?: number; offset?: number }, gymId?: number): Promise<CommunicationLogsListResponse> {
    const q = this.gymParams(gymId);
    if (params?.channel) q.set('channel', params.channel);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    const qs = q.toString();
    return this.request<CommunicationLogsListResponse>(`/api/communications${qs ? `?${qs}` : ''}`);
  }

  async recordPayment(payload: RecordPaymentRequest, gymId?: number): Promise<RecordPaymentResponse> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<RecordPaymentResponse>(`/api/payments${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Attendance
  async getAttendance(gymId?: number): Promise<{ logs: any[] }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ logs: any[] }>(`/api/attendance${qs ? `?${qs}` : ''}`);
  }

  async checkIn(payload: CheckInRequest, gymId?: number): Promise<CheckInResponse> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<CheckInResponse>(`/api/attendance/check-in${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Staff
  async getStaff(gymId?: number): Promise<{ staff: User[] }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ staff: User[] }>(`/api/staff${qs ? `?${qs}` : ''}`);
  }

  async createStaff(payload: CreateStaffRequest, gymId?: number): Promise<User> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<User>(`/api/staff${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Notification Settings
  async getNotificationSettings(): Promise<NotificationSettingsResponse> {
    return this.request<NotificationSettingsResponse>('/api/settings/notifications');
  }

  async updateNotificationSettings(
    payload: NotificationSettingsRequest
  ): Promise<NotificationSettingsResponse> {
    return this.request<NotificationSettingsResponse>('/api/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async dispatchNotification(
    payload: SendNotificationRequest
  ): Promise<{ success: boolean; channel: string; remainingCredits: number; message: string; whatsappUrl?: string }> {
    return this.request('/api/settings/notifications/dispatch', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Reports
  async getReports(period: 'month' | 'quarter' | 'year' = 'month'): Promise<{
    metrics: DashboardMetrics;
    period: string;
    periodRevenue: number;
    periodPaymentCount: number;
    planBreakdown: any[];
  }> {
    return this.request(`/api/reports?period=${period}`);
  }

  async getInvoice(paymentId: number): Promise<InvoiceData> {
    return this.request<InvoiceData>(`/api/payments/${paymentId}/invoice`);
  }

  async downloadReportExport(type: 'payments' | 'members' | 'attendance' | 'dues'): Promise<void> {
    // Session is in an httpOnly cookie; just send credentials.
    const res = await fetch(`${API_BASE_URL}/api/reports/export?type=${type}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const data: any = await res.json().catch(() => ({}));
      throw new Error(data.error || `Export failed (HTTP ${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gymtech-${type}-report.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // PT Collections
  async getPtCollections(params?: { trainerId?: number }): Promise<{ collections: PtCollectionRow[] }> {
    const q = new URLSearchParams();
    if (params?.trainerId) q.set('trainerId', String(params.trainerId));
    const qs = q.toString();
    return this.request<{ collections: PtCollectionRow[] }>(`/api/pt/collections${qs ? `?${qs}` : ''}`);
  }

  async getPtSummary(): Promise<PtSummary> {
    return this.request<PtSummary>('/api/pt/summary');
  }

  async recordPtCollection(payload: RecordPtCollectionRequest): Promise<RecordPtCollectionResponse> {
    return this.request<RecordPtCollectionResponse>('/api/pt/collections', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async settlePtCommission(id: number, status: 'PAID' | 'PENDING'): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/pt/collections/${id}/settle`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  // Super Admin
  async getAdminGyms(): Promise<{ gyms: any[] }> {
    return this.request<{ gyms: any[] }>('/api/admin/gyms');
  }

  async getAdminLicenses(): Promise<{ licenses: any[] }> {
    return this.request<{ licenses: any[] }>('/api/admin/licenses');
  }

  async getAdminMetrics(): Promise<{ totalGyms: number; activeGyms: number; totalMembers: number; platformRevenue: number }> {
    return this.request<{ totalGyms: number; activeGyms: number; totalMembers: number; platformRevenue: number }>('/api/admin/metrics');
  }

  async createGym(payload: CreateGymRequest): Promise<{ gymId: number; userId: number }> {
    return this.request<{ gymId: number; userId: number }>('/api/admin/gyms', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async toggleGymStatus(gymId: number, status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'): Promise<{ success: boolean; status: string }> {
    return this.request<{ success: boolean; status: string }>(`/api/admin/gyms/${gymId}/status`, {
      method: 'POST',
      body: JSON.stringify({ gymId, status }),
    });
  }

  // Super Admin Communications & Gateways
  async getAdminCommunications(): Promise<{ config: PlatformCommunicationsConfig }> {
    return this.request<{ config: PlatformCommunicationsConfig }>('/api/admin/communications');
  }

  async updateAdminCommunications(config: PlatformCommunicationsConfig): Promise<{ success: boolean; config: PlatformCommunicationsConfig }> {
    return this.request<{ success: boolean; config: PlatformCommunicationsConfig }>('/api/admin/communications', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async testAdminSmtp(payload: TestSmtpRequest): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/admin/communications/test-smtp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async topUpGymCredits(gymId: number, payload: { channel: 'sms' | 'whatsapp' | 'email'; credits: number }): Promise<{ success: boolean; license: any }> {
    return this.request<{ success: boolean; license: any }>(`/api/admin/gyms/${gymId}/top-up-credits`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Soft Deletes & Lifecycle Archival
  async archiveMember(id: number, gymId?: number): Promise<{ success: boolean; message: string }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ success: boolean; message: string }>(`/api/members/${id}${qs ? `?${qs}` : ''}`, {
      method: 'DELETE',
    });
  }

  async restoreMember(id: number, gymId?: number): Promise<{ success: boolean; member: any; message: string }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ success: boolean; member: any; message: string }>(`/api/members/${id}/restore${qs ? `?${qs}` : ''}`, {
      method: 'POST',
    });
  }

  async archivePlan(id: number, gymId?: number): Promise<{ success: boolean; message: string }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ success: boolean; message: string }>(`/api/plans/${id}${qs ? `?${qs}` : ''}`, {
      method: 'DELETE',
    });
  }

  async restorePlan(id: number, gymId?: number): Promise<{ success: boolean; message: string }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ success: boolean; message: string }>(`/api/plans/${id}/restore${qs ? `?${qs}` : ''}`, {
      method: 'POST',
    });
  }

  async archiveStaff(id: number, gymId?: number): Promise<{ success: boolean; message: string }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ success: boolean; message: string }>(`/api/staff/${id}${qs ? `?${qs}` : ''}`, {
      method: 'DELETE',
    });
  }

  async restoreStaff(id: number, gymId?: number): Promise<{ success: boolean; message: string }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ success: boolean; message: string }>(`/api/staff/${id}/restore${qs ? `?${qs}` : ''}`, {
      method: 'POST',
    });
  }

  // Super Admin Fine-Grained Controls
  async getGymFeatures(gymId: number): Promise<{ features: Record<string, boolean> }> {
    return this.request<{ features: Record<string, boolean> }>(`/api/admin/gyms/${gymId}/features`);
  }

  async updateGymFeatures(gymId: number, features: Record<string, boolean>): Promise<{ success: boolean; features: Record<string, boolean> }> {
    return this.request<{ success: boolean; features: Record<string, boolean> }>(`/api/admin/gyms/${gymId}/features`, {
      method: 'PUT',
      body: JSON.stringify({ features }),
    });
  }

  async getGymUsers(gymId: number): Promise<{ users: any[] }> {
    return this.request<{ users: any[] }>(`/api/admin/gyms/${gymId}/users`);
  }

  async updateAdminUser(userId: number, patch: any): Promise<{ success: boolean; user?: any; message?: string }> {
    return this.request<{ success: boolean; user?: any; message?: string }>(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  }

  async updateLicenseLimits(gymId: number, patch: any): Promise<{ success: boolean; license?: any }> {
    return this.request<{ success: boolean; license?: any }>(`/api/admin/gyms/${gymId}/license-limits`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  }

  async getAdminAuditLogs(params?: { limit?: number; offset?: number; action?: string; affectedGymId?: number }): Promise<{ events: any[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.action) q.set('action', params.action);
    if (params?.affectedGymId) q.set('affectedGymId', String(params.affectedGymId));
    const qs = q.toString();
    return this.request<{ events: any[]; total: number }>(`/api/admin/audit-logs${qs ? `?${qs}` : ''}`);
  }

  async getGymAuditLogs(params?: { limit?: number; offset?: number; action?: string; entityType?: string }): Promise<{ events: any[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.action) q.set('action', params.action);
    if (params?.entityType) q.set('entityType', params.entityType);
    const qs = q.toString();
    return this.request<{ events: any[]; total: number }>(`/api/audit-logs${qs ? `?${qs}` : ''}`);
  }

  // ----- Platform Admin -----

  async getPlatformRoles(params?: { gymId?: number }): Promise<{ roles: any[] }> {
    const q = new URLSearchParams();
    if (params?.gymId) q.set('gymId', String(params.gymId));
    const qs = q.toString();
    return this.request<{ roles: any[] }>(`/api/admin/roles${qs ? `?${qs}` : ''}`);
  }

  async createPlatformRole(data: { gymId: number; name: string; permissions: string[]; isDefault?: boolean }): Promise<any> {
    return this.request<any>('/api/admin/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePlatformRole(id: number, data: { name?: string; permissions?: string[]; isDefault?: boolean }): Promise<any> {
    return this.request<any>(`/api/admin/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePlatformRole(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/admin/roles/${id}`, { method: 'DELETE' });
  }

  async restorePlatformRole(id: number): Promise<any> {
    return this.request<any>(`/api/admin/roles/${id}/restore`, { method: 'POST' });
  }

  async getMenuGroups(): Promise<{ groups: any[] }> {
    return this.request<{ groups: any[] }>('/api/admin/menus/groups');
  }

  async createMenuGroup(data: { key: string; label: string; icon?: string; order?: number }): Promise<any> {
    return this.request<any>('/api/admin/menus/groups', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateMenuGroup(id: number, data: { label?: string; icon?: string; order?: number }): Promise<any> {
    return this.request<any>(`/api/admin/menus/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteMenuGroup(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/admin/menus/groups/${id}`, { method: 'DELETE' });
  }

  async getMenuItems(params?: { groupKey?: string }): Promise<{ items: any[] }> {
    const q = new URLSearchParams();
    if (params?.groupKey) q.set('groupKey', params.groupKey);
    const qs = q.toString();
    return this.request<{ items: any[] }>(`/api/admin/menus/items${qs ? `?${qs}` : ''}`);
  }

  async createMenuItem(data: {
    groupKey: string; key: string; label: string; href?: string; icon?: string;
    order?: number; permissions?: string[]; featureKey?: string; adminOnly?: boolean;
  }): Promise<any> {
    return this.request<any>('/api/admin/menus/items', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateMenuItem(id: number, data: {
    label?: string; href?: string; icon?: string; order?: number;
    permissions?: string[]; featureKey?: string; adminOnly?: boolean; isActive?: boolean;
  }): Promise<any> {
    return this.request<any>(`/api/admin/menus/items/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteMenuItem(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/admin/menus/items/${id}`, { method: 'DELETE' });
  }

  async restoreMenuGroup(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/admin/menus/groups/${id}/restore`, { method: 'POST' });
  }

  async restoreMenuItem(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/admin/menus/items/${id}/restore`, { method: 'POST' });
  }

  async getPlatformUsers(params?: { page?: number; limit?: number; search?: string; gymId?: number }): Promise<{ users: any[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.gymId) q.set('gymId', String(params.gymId));
    const qs = q.toString();
    return this.request<{ users: any[]; total: number }>(`/api/admin/users${qs ? `?${qs}` : ''}`);
  }

  async getPlatformUser(id: number): Promise<any> {
    return this.request<any>(`/api/admin/users/${id}`);
  }

  async updatePlatformUserRole(id: number, roleId: number | null): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/admin/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ roleId }),
    });
  }

  async disablePlatformUser(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/admin/users/${id}/disable`, { method: 'PUT' });
  }

  async enablePlatformUser(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/admin/users/${id}/enable`, { method: 'PUT' });
  }

  async getAvailableRolesForUser(userId: number): Promise<{ roles: any[] }> {
    return this.request<{ roles: any[] }>(`/api/admin/users/${userId}/available-roles`);
  }

  async createPlatformUser(data: {
    gymId: number; name: string; email: string; phone?: string;
    roleId?: number; password?: string;
  }): Promise<{ id: number }> {
    return this.request<{ id: number }>('/api/admin/users', { method: 'POST', body: JSON.stringify(data) });
  }
}

export const api = new ApiClient();
