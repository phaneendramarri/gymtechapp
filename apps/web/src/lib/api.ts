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

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Echo the CSRF token on state-changing requests. The server requires
    // it to match the `gym_csrf` cookie.
    const method = (options.method || 'GET').toUpperCase();
    if (!SAFE_METHODS.has(method)) {
      const csrf = readCsrfCookie();
      if (csrf) headers['X-CSRF-Token'] = csrf;
    }

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      // Send cookies on same-origin and (for Vite proxy / same host dev) cross-origin.
      credentials: 'include',
    });

    if (res.status === 401) {
      // The server has already cleared the session cookie. We just need to
      // route the user back to the login screen.
      if (!window.location.hash.includes('/login') && window.location.hash !== '' && window.location.hash !== '#/') {
        window.location.hash = '#/login';
      }
    }

    const data: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
    }

    return data as T;
  }

  // Auth
  async login(payload: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
    return this.request<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
    });
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
    return this.request('/api/member/portal');
  }

  // Dashboard
  async getDashboard(): Promise<DashboardMetrics> {
    return this.request<DashboardMetrics>('/api/dashboard');
  }

  // Members
  async getMembers(params?: { search?: string; status?: string; limit?: number; offset?: number }): Promise<{ members: any[] }> {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status && params.status !== 'ALL') q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));

    const qs = q.toString();
    return this.request<{ members: any[] }>(`/api/members${qs ? `?${qs}` : ''}`);
  }

  async createMember(payload: CreateMemberRequest): Promise<CreateMemberResponse> {
    return this.request<CreateMemberResponse>('/api/members', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async bulkImportMembers(payload: BulkImportMembersRequest): Promise<BulkImportMembersResponse> {
    return this.request<BulkImportMembersResponse>('/api/members/bulk-import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getMemberDetail(id: number): Promise<MemberDetailResponse> {
    return this.request<MemberDetailResponse>(`/api/members/${id}`);
  }

  async updateMember(id: number, payload: UpdateMemberRequest): Promise<Member> {
    return this.request<Member>(`/api/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async renewMembership(id: number, payload: RenewMembershipRequest): Promise<RenewMembershipResponse> {
    return this.request<RenewMembershipResponse>(`/api/members/${id}/renew`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async freezeMember(id: number, reason?: string): Promise<FreezeMemberResponse> {
    return this.request<FreezeMemberResponse>(`/api/members/${id}/freeze`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async unfreezeMember(id: number): Promise<FreezeMemberResponse> {
    return this.request<FreezeMemberResponse>(`/api/members/${id}/unfreeze`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // Plans
  async getPlans(): Promise<{ plans: GymMembershipPlan[] }> {
    return this.request<{ plans: GymMembershipPlan[] }>('/api/plans');
  }

  async createPlan(payload: CreatePlanRequest): Promise<GymMembershipPlan> {
    return this.request<GymMembershipPlan>('/api/plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Payments
  async getPayments(params?: { limit?: number; memberId?: string }): Promise<{ payments: Payment[]; summary: any }> {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.memberId) q.set('memberId', params.memberId);
    const qs = q.toString();
    return this.request<{ payments: Payment[]; summary: any }>(`/api/payments${qs ? `?${qs}` : ''}`);
  }

  async recordPayment(payload: RecordPaymentRequest): Promise<RecordPaymentResponse> {
    return this.request<RecordPaymentResponse>('/api/payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Attendance
  async getAttendance(): Promise<{ logs: any[] }> {
    return this.request<{ logs: any[] }>('/api/attendance');
  }

  async checkIn(payload: CheckInRequest): Promise<CheckInResponse> {
    return this.request<CheckInResponse>('/api/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Staff
  async getStaff(): Promise<{ staff: User[] }> {
    return this.request<{ staff: User[] }>('/api/staff');
  }

  async createStaff(payload: CreateStaffRequest): Promise<User> {
    return this.request<User>('/api/staff', {
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
    return this.request('/api/notifications/dispatch', {
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
  async archiveMember(id: number): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/members/${id}`, {
      method: 'DELETE',
    });
  }

  async restoreMember(id: number): Promise<{ success: boolean; member: any; message: string }> {
    return this.request<{ success: boolean; member: any; message: string }>(`/api/members/${id}/restore`, {
      method: 'POST',
    });
  }

  async archivePlan(id: number): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/plans/${id}`, {
      method: 'DELETE',
    });
  }

  async restorePlan(id: number): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/plans/${id}/restore`, {
      method: 'POST',
    });
  }

  async archiveStaff(id: number): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/staff/${id}`, {
      method: 'DELETE',
    });
  }

  async restoreStaff(id: number): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/staff/${id}/restore`, {
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
}

export const api = new ApiClient();
