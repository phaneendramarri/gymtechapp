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
  MenuItem,
  ClassItem,
  ClassSchedule,
  ClassBooking,
  CreateClassRequest,
  CreateScheduleRequest,
  BookClassRequest,
  Product,
  PosSale,
  CreateProductRequest,
  CreatePosSaleRequest,
  Expense,
  ExpenseCategory,
  CreateExpenseRequest,
  CreateExpenseCategoryRequest,
  Locker,
  LockerAllocation,
  CreateLockerRequest,
  AllocateLockerRequest,
  PtPackage,
  PtSession,
  CreatePtPackageRequest,
  LogPtSessionRequest,
} from '@gymtech/shared';

import { ApiClientBase, API_BASE_URL, saveCsrfToken, setStoredRefreshToken } from './api-client';

// Domain methods live here, grouped by resource (Auth, Dashboard, Members,
// Plans, Payments, Attendance, Staff, Roles, Settings, Reports, PT, Admin,
// Classes, POS, Expenses, Lockers). Transport (CSRF, refresh, request
// pipeline) lives in ./api-client.ts as ApiClientBase.

class ApiClient extends ApiClientBase {
  // Auth
  async login(payload: LoginRequest): Promise<LoginResponse> {
    // Bypass the refresh interceptor on login — store refresh token from response.
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const csrf = res.headers.get('X-CSRF-Token');
    if (csrf) saveCsrfToken(csrf);
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    // H-16: Persist refresh token for token-refresh interceptor
    if (data.refreshToken) setStoredRefreshToken(data.refreshToken);
    return data as LoginResponse;
  }

  async getMe(): Promise<MeResponse> {
    return this.request<MeResponse>('/api/auth/me');
  }

  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    return this.request<ForgotPasswordResponse>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async logout(): Promise<{ success: boolean }> {
    // Bypass interceptor — clear stored refresh token and CSRF then hit logout
    setStoredRefreshToken(null);
    saveCsrfToken(null);
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

  /** Exact code/phone/email → member lookup for client-side pickers (works past page 1). */
  async lookupMember(identifier: string, gymId?: number): Promise<{ member: { id: number; memberCode: string; firstName: string; lastName: string | null } }> {
    const q = this.gymParams(gymId);
    q.set('identifier', identifier.trim());
    return this.request<{ member: { id: number; memberCode: string; firstName: string; lastName: string | null } }>(`/api/members/lookup?${q.toString()}`);
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
  // The backend envelope is `{ items, total, …, summary }`; the UI reads
  // `payments` — translate here so every caller sees one shape.
  async getPayments(params?: { limit?: number; offset?: number; memberId?: string }, gymId?: number): Promise<{ payments: Payment[]; total: number; hasMore: boolean; summary: any }> {
    const q = this.gymParams(gymId);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.memberId) q.set('memberId', params.memberId);
    const qs = q.toString();
    const res = await this.request<{ items: Payment[]; total: number; hasMore: boolean; summary: any }>(`/api/payments${qs ? `?${qs}` : ''}`);
    return { payments: res.items ?? [], total: res.total, hasMore: res.hasMore, summary: res.summary };
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

  async updateStaff(
    id: number,
    payload: {
      name?: string;
      phone?: string;
      role?: string;
      roleId?: number | null;
      status?: 'ACTIVE' | 'DISABLED';
      permissions?: string[];
    },
    gymId?: number
  ): Promise<User> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<User>(`/api/staff/${id}${qs ? `?${qs}` : ''}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  // Database-Driven Menu System
  async getMenuItems(gymId?: number): Promise<{ items: MenuItem[] }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ items: MenuItem[] }>(`/api/menus${qs ? `?${qs}` : ''}`);
  }

  // Gym-Scoped Roles & Menu Permissions
  async getGymRoles(gymId?: number): Promise<{ roles: Array<{ id: number; name: string; permissions: string[]; menuItemIds?: number[]; isOwner?: boolean; isDefault?: boolean; createdAt?: number }> }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ roles: Array<{ id: number; name: string; permissions: string[]; menuItemIds?: number[]; isOwner?: boolean; isDefault?: boolean; createdAt?: number }> }>(`/api/roles${qs ? `?${qs}` : ''}`);
  }

  async createGymRole(payload: { name: string; menuItemIds?: number[]; permissions?: string[]; isDefault?: boolean }, gymId?: number): Promise<any> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<any>(`/api/roles${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateGymRole(id: number, payload: { name?: string; menuItemIds?: number[]; permissions?: string[]; isDefault?: boolean }, gymId?: number): Promise<any> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<any>(`/api/roles/${id}${qs ? `?${qs}` : ''}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteGymRole(id: number, gymId?: number): Promise<{ success: boolean; message: string }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ success: boolean; message: string }>(`/api/roles/${id}${qs ? `?${qs}` : ''}`, {
      method: 'DELETE',
    });
  }

  // Gym Profile & Settings
  async getGymProfile(gymId?: number): Promise<any> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<any>(`/api/settings/gym${qs ? `?${qs}` : ''}`);
  }

  async updateGymProfile(payload: Record<string, any>, gymId?: number): Promise<any> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<any>(`/api/settings/gym${qs ? `?${qs}` : ''}`, {
      method: 'PATCH',
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

  // Backend returns `{ summary: { totalRevenue, … }, byPlan, timeSeries }`;
  // the Reports page reads `totalRevenue.{total_paise,…}` + `revenueByPlan`.
  async getRevenueReport(params: {
    startDate: number;
    endDate: number;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<{
    totalRevenue: { total_paise: number; payment_count: number; cash_paise: number; upi_paise: number; card_paise: number; bank_paise: number };
    revenueByPlan: Array<{ plan_name: string; revenue_paise: number; payment_count: number; member_count: number }>;
    timeSeries: Array<{ period: string; revenue_paise: number; payment_count: number }>;
  }> {
    const q = new URLSearchParams({
      startDate: String(params.startDate),
      endDate: String(params.endDate),
      groupBy: params.groupBy || 'day',
    });
    const res = await this.request<any>(`/api/reports/revenue?${q}`);
    const s = res.summary ?? {};
    return {
      totalRevenue: {
        total_paise: s.totalRevenue ?? 0,
        payment_count: s.paymentCount ?? 0,
        cash_paise: s.cashRevenue ?? 0,
        upi_paise: s.upiRevenue ?? 0,
        card_paise: s.cardRevenue ?? 0,
        bank_paise: s.bankRevenue ?? 0,
      },
      revenueByPlan: res.byPlan ?? [],
      timeSeries: res.timeSeries ?? [],
    };
  }

  async getMembershipReport(params: {
    startDate: number;
    endDate: number;
    status?: string;
  }): Promise<{
    summary: { total_active: number; new_memberships: number; renewals: number; expired: number; frozen: number };
    byPlan: Array<{ plan_name: string; active_count: number; expiring_soon: number }>;
    expiring: Array<{ member_id: number; member_name: string; member_code: string; plan_name: string; end_date: number }>;
  }> {
    const q = new URLSearchParams({
      startDate: String(params.startDate),
      endDate: String(params.endDate),
    });
    if (params.status) q.set('status', params.status);
    return this.request(`/api/reports/membership?${q}`);
  }

  async getAttendanceReport(params: {
    startDate: number;
    endDate: number;
    memberId?: number;
  }): Promise<{
    summary: { total_checkins: number; unique_members: number; avg_daily: number };
    byDay: Array<{ date: string; checkin_count: number }>;
    peakHours: Array<{ hour: number; checkin_count: number }>;
    topMembers: Array<{ member_id: number; member_name: string; checkin_count: number }>;
  }> {
    const q = new URLSearchParams({
      startDate: String(params.startDate),
      endDate: String(params.endDate),
    });
    if (params.memberId) q.set('memberId', String(params.memberId));
    return this.request(`/api/reports/attendance?${q}`);
  }

  async getMemberGrowthReport(startDate: number, endDate: number): Promise<{
    summary: { total_joins: number; total_churned: number; net_growth: number };
    series: Array<{ period: string; joins: number; churned: number; net: number }>;
  }> {
    const q = new URLSearchParams({ startDate: String(startDate), endDate: String(endDate) });
    return this.request(`/api/reports/growth?${q}`);
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

  // --- Classes & Timetable ---
  async getClasses(gymId?: number): Promise<{ classes: ClassItem[] }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ classes: ClassItem[] }>(`/api/classes${qs ? `?${qs}` : ''}`);
  }

  async createClass(data: CreateClassRequest, gymId?: number): Promise<{ id: number }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ id: number }>(`/api/classes${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClass(id: number, data: Partial<CreateClassRequest>, gymId?: number): Promise<{ success: boolean }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ success: boolean }>(`/api/classes/${id}${qs ? `?${qs}` : ''}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteClass(id: number, gymId?: number): Promise<{ success: boolean }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ success: boolean }>(`/api/classes/${id}${qs ? `?${qs}` : ''}`, {
      method: 'DELETE',
    });
  }

  async getClassSchedules(params?: { classId?: number; dayOfWeek?: number; gymId?: number }): Promise<{ schedules: ClassSchedule[] }> {
    const q = this.gymParams(params?.gymId);
    if (params?.classId) q.set('classId', String(params.classId));
    if (params?.dayOfWeek !== undefined) q.set('dayOfWeek', String(params.dayOfWeek));
    const qs = q.toString();
    return this.request<{ schedules: ClassSchedule[] }>(`/api/classes/schedules${qs ? `?${qs}` : ''}`);
  }

  async createClassSchedule(data: CreateScheduleRequest, gymId?: number): Promise<{ id: number }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ id: number }>(`/api/classes/schedules${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteClassSchedule(id: number, gymId?: number): Promise<{ success: boolean }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ success: boolean }>(`/api/classes/schedules/${id}${qs ? `?${qs}` : ''}`, {
      method: 'DELETE',
    });
  }

  async getClassBookings(scheduleId: number, bookingDate: string, gymId?: number): Promise<{ bookings: ClassBooking[] }> {
    const q = this.gymParams(gymId);
    q.set('scheduleId', String(scheduleId));
    q.set('bookingDate', bookingDate);
    const qs = q.toString();
    return this.request<{ bookings: ClassBooking[] }>(`/api/classes/bookings${qs ? `?${qs}` : ''}`);
  }

  async bookClass(data: BookClassRequest, gymId?: number): Promise<{ id: number; bookingStatus: string }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ id: number; bookingStatus: string }>(`/api/classes/bookings${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelClassBooking(id: number, gymId?: number): Promise<{ success: boolean }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ success: boolean }>(`/api/classes/bookings/${id}/cancel${qs ? `?${qs}` : ''}`, {
      method: 'POST',
    });
  }

  // --- POS & Retail ---
  async getProducts(gymId?: number): Promise<{ products: Product[] }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ products: Product[] }>(`/api/pos/products${qs ? `?${qs}` : ''}`);
  }

  async createProduct(data: CreateProductRequest, gymId?: number): Promise<{ id: number }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ id: number }>(`/api/pos/products${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: number, data: Partial<CreateProductRequest>, gymId?: number): Promise<{ success: boolean }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ success: boolean }>(`/api/pos/products/${id}${qs ? `?${qs}` : ''}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: number, gymId?: number): Promise<{ success: boolean }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ success: boolean }>(`/api/pos/products/${id}${qs ? `?${qs}` : ''}`, {
      method: 'DELETE',
    });
  }

  async getPosSales(gymId?: number): Promise<{ sales: PosSale[] }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ sales: PosSale[] }>(`/api/pos/sales${qs ? `?${qs}` : ''}`);
  }

  // The backend returns `{ id, receiptNumber }`; the UI calls it invoiceNumber.
  async createPosSale(data: CreatePosSaleRequest, gymId?: number): Promise<{ id: number; invoiceNumber: string; receiptNumber: string; totalPaise: number }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    const res = await this.request<{ id: number; receiptNumber: string }>(`/api/pos/sales${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    // The backend returns only { id, receiptNumber }; recompute the displayed
    // total from the submitted items (same math the repo uses).
    const totalPaise = (data.items ?? []).reduce((sum, it) => sum + it.quantity * it.unitPricePaise, 0);
    return { id: res.id, invoiceNumber: res.receiptNumber, receiptNumber: res.receiptNumber, totalPaise };
  }

  // --- Expenses & P&L ---
  async getExpenseCategories(gymId?: number): Promise<{ categories: ExpenseCategory[] }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ categories: ExpenseCategory[] }>(`/api/expenses/categories${qs ? `?${qs}` : ''}`);
  }

  async createExpenseCategory(data: CreateExpenseCategoryRequest, gymId?: number): Promise<{ id: number }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ id: number }>(`/api/expenses/categories${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getExpenses(params?: { categoryId?: number; from?: string; to?: string; gymId?: number }): Promise<{ expenses: Expense[] }> {
    const q = this.gymParams(params?.gymId);
    if (params?.categoryId) q.set('categoryId', String(params.categoryId));
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    const qs = q.toString();
    return this.request<{ expenses: Expense[] }>(`/api/expenses${qs ? `?${qs}` : ''}`);
  }

  async createExpense(data: CreateExpenseRequest, gymId?: number): Promise<{ id: number }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ id: number }>(`/api/expenses${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteExpense(id: number, gymId?: number): Promise<{ success: boolean }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ success: boolean }>(`/api/expenses/${id}${qs ? `?${qs}` : ''}`, {
      method: 'DELETE',
    });
  }

  async getProfitLoss(params?: { from?: string; to?: string; gymId?: number }): Promise<{
    revenuePaise: { memberships: number; pt: number; pos: number; total: number };
    expensesPaise: { byCategory: Array<{ category: string; amountPaise: number }>; total: number };
    netProfitPaise: number;
  }> {
    const q = this.gymParams(params?.gymId);
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    const qs = q.toString();
    return this.request<{
      revenuePaise: { memberships: number; pt: number; pos: number; total: number };
      expensesPaise: { byCategory: Array<{ category: string; amountPaise: number }>; total: number };
      netProfitPaise: number;
    }>(`/api/expenses/pnl${qs ? `?${qs}` : ''}`);
  }

  // --- Lockers ---
  async getLockers(gymId?: number): Promise<{ lockers: Locker[] }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ lockers: Locker[] }>(`/api/lockers${qs ? `?${qs}` : ''}`);
  }

  async createLocker(data: CreateLockerRequest, gymId?: number): Promise<{ id: number }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ id: number }>(`/api/lockers${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async allocateLocker(data: AllocateLockerRequest, gymId?: number): Promise<{ id: number }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ id: number }>(`/api/lockers/allocate${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async releaseLocker(id: number, gymId?: number): Promise<{ success: boolean }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ success: boolean }>(`/api/lockers/allocations/${id}/terminate${qs ? `?${qs}` : ''}`, {
      method: 'POST',
    });
  }

  // --- PT Packages & Sessions ---
  async getPtPackages(params?: { memberId?: number; trainerId?: number; gymId?: number }): Promise<{ packages: PtPackage[] }> {
    const q = this.gymParams(params?.gymId);
    if (params?.memberId) q.set('memberId', String(params.memberId));
    if (params?.trainerId) q.set('trainerId', String(params.trainerId));
    const qs = q.toString();
    return this.request<{ packages: PtPackage[] }>(`/api/pt/packages${qs ? `?${qs}` : ''}`);
  }

  async createPtPackage(data: CreatePtPackageRequest, gymId?: number): Promise<{ id: number }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ id: number }>(`/api/pt/packages${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPtSessions(params?: { packageId?: number; memberId?: number; gymId?: number }): Promise<{ sessions: PtSession[] }> {
    const q = this.gymParams(params?.gymId);
    if (params?.packageId) q.set('packageId', String(params.packageId));
    if (params?.memberId) q.set('memberId', String(params.memberId));
    const qs = q.toString();
    return this.request<{ sessions: PtSession[] }>(`/api/pt/sessions${qs ? `?${qs}` : ''}`);
  }

  async logPtSession(data: LogPtSessionRequest, gymId?: number): Promise<{ id: number; remainingSessions: number }> {
    const q = this.gymParams(gymId);
    const qs = q.toString();
    return this.request<{ id: number; remainingSessions: number }>(`/api/pt/sessions${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
