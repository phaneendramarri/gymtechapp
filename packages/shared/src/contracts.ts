import { z } from 'zod';
import {
  Gym,
  Member,
  Membership,
  Payment,
  Attendance,
  License,
  SessionUser,
  DashboardMetrics,
} from './types';

/**
 * Typed RPC client type is now derived in the web app directly:
 *
 *   import { hc } from 'hono/client';
 *   import type { AppType } from '@gymtech/api/app';
 *   const client = hc<AppType>(baseUrl);
 *
 * Keeping `@gymtech/shared` free of API imports avoids a cyclic workspace
 * dependency (shared → api → shared).
 */

// ==========================================
// 1. AUTH CONTRACTS
// ==========================================

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  turnstileToken: z.string().optional(),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export interface LoginResponse {
  token: string;
  user: SessionUser;
  gym?: Gym | null;
}

export const MemberLoginRequestSchema = z.object({
  // gymSlug is required to scope the lookup to a specific gym tenant.
  gymSlug: z.string().min(1, 'Gym slug is required'),
  identifier: z.string().min(3, 'Phone number or member code is required'),
  codeOrPin: z.string().min(1, 'Member code or verification credential is required'),
  turnstileToken: z.string().optional(),
});
export type MemberLoginRequest = z.infer<typeof MemberLoginRequestSchema>;

export interface MemberLoginResponse {
  token: string;
  member: Member;
  activeMembership?: Membership | null;
  gym?: Gym | null;
}

export interface MeResponse {
  user: SessionUser;
  gym?: Gym | null;
}

// ==========================================
// 2. MEMBER CONTRACTS
// ==========================================

export const CreateMemberRequestSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  phone: z.string().min(10, 'Valid 10-digit phone required'),
  email: z.string().email().optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dateOfBirth: z.string().optional(),
  joinedDate: z.string().optional(),
  photoUrl: z.string().optional(),
  faceEmbedding: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  healthNotes: z.string().optional(),
  planId: z.number().int().positive('Plan selection is required'),
  discountPaise: z.number().int().min(0).default(0),
  initialPaymentPaise: z.number().int().min(0).default(0),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER']).default('UPI'),
  referenceId: z.string().optional(),
});
export type CreateMemberRequest = z.infer<typeof CreateMemberRequestSchema>;

export interface CreateMemberResponse {
  member: Member;
  membership: Membership;
  payment?: Payment | null;
  receiptNumber?: string;
  whatsappUrl?: string;
}

export const UpdateMemberRequestSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dateOfBirth: z.string().optional(),
  photoUrl: z.string().optional(),
  faceEmbedding: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  healthNotes: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED', 'EXPIRED', 'FROZEN']).optional(),
});
export type UpdateMemberRequest = z.infer<typeof UpdateMemberRequestSchema>;

export interface MemberDetailResponse {
  member: Member;
  activeMembership?: Membership | null;
  memberships: Membership[];
  payments: Payment[];
  attendance: Attendance[];
}

// ==========================================
// 3. MEMBERSHIP & PLAN CONTRACTS
// ==========================================

export const RenewMembershipRequestSchema = z.object({
  planId: z.number().int().positive('Plan selection is required'),
  startDate: z.string().optional(),
  discountPaise: z.number().int().min(0).default(0),
  paymentPaise: z.number().int().min(0).default(0),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER']).default('UPI'),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});
export type RenewMembershipRequest = z.infer<typeof RenewMembershipRequestSchema>;

export interface RenewMembershipResponse {
  membershipId: number;
  receiptNumber?: string;
  whatsappUrl?: string;
}

export const CreatePlanRequestSchema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  description: z.string().optional(),
  durationMonths: z.number().int().min(1, 'Duration in months is required'),
  pricePaise: z.number().int().min(0, 'Price must be non-negative'),
  admissionFeePaise: z.number().int().min(0).default(0),
  taxPercentage: z.number().min(0).max(100).default(0),
  billingPeriod: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'), // L9/L10: revenue bucketing
});
export type CreatePlanRequest = z.infer<typeof CreatePlanRequestSchema>;

/**
 * PATCH-style schema for plan updates. Every field is optional, but the
 * union of provided fields is the only thing forwarded to the repository —
 * server-managed fields (gym_id, deleted_at, is_active) are NOT accepted.
 */
export const UpdatePlanRequestSchema = z.object({
  name: z.string().min(1, 'Plan name is required').optional(),
  description: z.string().nullable().optional(),
  durationMonths: z.number().int().min(1).optional(),
  pricePaise: z.number().int().min(0).optional(),
  admissionFeePaise: z.number().int().min(0).optional(),
  taxPercentage: z.number().min(0).max(100).optional(),
  billingPeriod: z.enum(['MONTHLY', 'YEARLY']).optional(), // L9/L10: revenue bucketing
});
export type UpdatePlanRequest = z.infer<typeof UpdatePlanRequestSchema>;

// ==========================================
// 4. PAYMENT CONTRACTS
// ==========================================

export const RecordPaymentRequestSchema = z.object({
  memberId: z.number().int().positive(),
  membershipId: z.number().int().positive().optional(),
  amountPaise: z.number().int().min(1, 'Amount must be greater than 0'),
  paymentDate: z.string().optional(),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER']).default('CASH'),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});
export type RecordPaymentRequest = z.infer<typeof RecordPaymentRequestSchema>;

export interface RecordPaymentResponse {
  paymentId?: number;
  payment?: Payment;
  receiptNumber: string;
  whatsappUrl?: string;
}

// ==========================================
// 5. ATTENDANCE CONTRACTS
// ==========================================

export const CheckInRequestSchema = z.object({
  memberIdOrCode: z.string().min(1, 'Member ID or code is required'),
  method: z.enum(['MANUAL', 'QR', 'FACE_ID']).default('MANUAL'),
});
export type CheckInRequest = z.infer<typeof CheckInRequestSchema>;

export interface CheckInResponse {
  success?: boolean;
  alreadyCheckedIn?: boolean;
  attendance?: Attendance;
  member: {
    id: number;
    name: string;
    memberCode: string;
    phone?: string;
    status?: string;
    membershipStatus?: string;
    planName?: string;
    daysRemaining?: number;
  };
}

// ==========================================
// 6. ROLE CONTRACTS
// ==========================================

export const CreateRoleRequestSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(50),
  permissions: z.array(z.string()).default([]),
  isDefault: z.boolean().default(false),
});
export type CreateRoleRequest = z.infer<typeof CreateRoleRequestSchema>;

export const UpdateRoleRequestSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  permissions: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateRoleRequest = z.infer<typeof UpdateRoleRequestSchema>;

// ==========================================
// 7. STAFF CONTRACTS
// ==========================================

export const CreateStaffRequestSchema = z.object({
  name: z.string().min(1, 'Staff name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(10, 'Valid phone required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  /**
   * FK to the gym's custom role. Required for non-owner staff.
   * The owner is created with roleId = null.
   */
  roleId: z.number().int().positive().nullable().optional(),
  /**
   * Legacy display label stored on the user row.
   * Defaults to 'STAFF'. Ignored when roleId is set.
   * @deprecated use roleId instead
   */
  role: z.string().optional().default('STAFF'),
  /** Additional per-user permission overrides (merged with role permissions) */
  permissions: z.array(z.string()).default([]),
});
export type CreateStaffRequest = z.infer<typeof CreateStaffRequestSchema>;

// ==========================================
// ==========================================
// 8. SUPER ADMIN CONTRACTS
// ==========================================
// ==========================================

export const CreateGymRequestSchema = z.object({
  gymName: z.string().min(1, 'Gym name is required'),
  slug: z.string().min(1, 'Slug is required'),
  city: z.string().optional(),
  gymPhone: z.string().min(10, 'Valid phone required'),
  licenseName: z.string().min(1, 'Plan name is required'),
  licenseCode: z.string().min(1, 'Plan code is required'),
  pricePaise: z.number().int().min(0).default(0),
  billingPeriod: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
  maxMembers: z.number().int().min(-1).default(50),
  maxOwners: z.number().int().min(0).default(1),
  maxManagers: z.number().int().min(0).default(2),
  maxStaffTotal: z.number().int().min(0).default(5),
  features: z.string().default('{}'),
  durationDays: z.number().int().min(1).default(30),
  ownerName: z.string().min(1, 'Owner name is required'),
  ownerEmail: z.string().email('Valid email required'),
  ownerPhone: z.string().min(10, 'Valid phone required'),
  ownerPassword: z.string().min(6, 'Password must be at least 6 characters'),
});
export type CreateGymRequest = z.infer<typeof CreateGymRequestSchema>;

export const ToggleGymStatusRequestSchema = z.object({
  gymId: z.number().int().positive(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED']),
});
export type ToggleGymStatusRequest = z.infer<typeof ToggleGymStatusRequestSchema>;

export const UpdateLicenseRequestSchema = z.object({
  gymId: z.number().int().positive(),
  licenseId: z.number().int().positive(),
  name: z.string().min(1).optional(),
  pricePaise: z.number().int().min(0).optional(),
  maxMembers: z.number().int().min(-1).optional(),
  maxOwners: z.number().int().min(0).optional(),
  maxManagers: z.number().int().min(0).optional(),
  maxStaffTotal: z.number().int().min(0).optional(),
  maxSms: z.number().int().min(0).optional(),
  maxWhatsapp: z.number().int().min(0).optional(),
  maxEmail: z.number().int().min(0).optional(),
  features: z.string().optional(),
  expiresAt: z.number().int().positive().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'SUSPENDED']).optional(),
});
export type UpdateLicenseRequest = z.infer<typeof UpdateLicenseRequestSchema>;

// ==========================================
// 9. BULK EXCEL MIGRATION CONTRACTS
// ==========================================

export const BulkImportMemberRowSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional().default(''),
  phone: z.string().min(10, 'Valid 10-digit phone required'),
  email: z.string().email().optional().or(z.literal('')).default(''),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().default('MALE'),
  planName: z.string().optional().default(''),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  paidPaise: z.number().int().min(0).optional().default(0),
  duePaise: z.number().int().min(0).optional().default(0),
});
export type BulkImportMemberRow = z.infer<typeof BulkImportMemberRowSchema>;

export const BulkImportMembersRequestSchema = z.object({
  members: z.array(BulkImportMemberRowSchema).min(1, 'At least one member record is required'),
  defaultPlanId: z.number().int().positive().optional(),
});
export type BulkImportMembersRequest = z.infer<typeof BulkImportMembersRequestSchema>;

export interface BulkImportMembersResponse {
  success: boolean;
  totalProcessed: number;
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

// ==========================================
// 10. FORGOT & RESET PASSWORD CONTRACTS
// ==========================================

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  devResetUrl?: string;
}

export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

// ==========================================
// 11. FREEZE / PAUSE MEMBERSHIP CONTRACTS
// ==========================================

export const FreezeMemberRequestSchema = z.object({
  reason: z.string().max(200).optional(),
});
export type FreezeMemberRequest = z.infer<typeof FreezeMemberRequestSchema>;

export interface FreezeMemberResponse {
  success: boolean;
  status: 'FROZEN' | 'ACTIVE';
  membershipId?: number | null;
  extendedTo?: number | null;
  message: string;
}

// ==========================================
// 12. PT COLLECTION CONTRACTS
// ==========================================

export const RecordPtCollectionRequestSchema = z.object({
  memberId: z.number().int().positive('Member selection is required'),
  trainerId: z.number().int().positive('Trainer selection is required'),
  sessions: z.number().int().min(0).default(0),
  amountPaise: z.number().int().min(1, 'Amount must be greater than 0'),
  commissionPercentage: z.number().min(0).max(100).default(0),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER']).default('CASH'),
  paymentDate: z.string().optional(),
  notes: z.string().optional(),
});
export type RecordPtCollectionRequest = z.infer<typeof RecordPtCollectionRequestSchema>;

export interface RecordPtCollectionResponse {
  id: number;
  commissionPaise: number;
}

export const SettlePtCommissionRequestSchema = z.object({
  status: z.enum(['PAID', 'PENDING']),
});
export type SettlePtCommissionRequest = z.infer<typeof SettlePtCommissionRequestSchema>;

// ==========================================
// 13. NOTIFICATION & SMTP SETTINGS CONTRACTS
// ==========================================

export const SmtpSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(['CUSTOM', 'GMAIL', 'SENDGRID', 'AWS_SES', 'BREVO', 'RESEND']).default('CUSTOM'),
  host: z.string().optional().default(''),
  port: z.number().int().min(1).max(65535).optional().default(587),
  secure: z.boolean().default(false), // true = SSL (465), false = TLS/STARTTLS (587)
  username: z.string().optional().default(''),
  password: z.string().optional().default(''),
  fromName: z.string().optional().default(''),
  fromEmail: z.string().email('Valid from-email required').optional().or(z.literal('')).default(''),
});
export type SmtpSettings = z.infer<typeof SmtpSettingsSchema>;

export const TestSmtpRequestSchema = z.object({
  smtp: SmtpSettingsSchema,
  testRecipient: z.string().email('Valid test recipient email required'),
});
export type TestSmtpRequest = z.infer<typeof TestSmtpRequestSchema>;

// Super-Admin Platform Communications & Gateway Configuration
export const PlatformCommunicationsConfigSchema = z.object({
  smtp: SmtpSettingsSchema.optional(),
  smsGateway: z.object({
    enabled: z.boolean().default(false),
    provider: z.enum(['FAST2SMS', 'TWILIO', 'MSG91', 'CUSTOM']).default('FAST2SMS'),
    apiKey: z.string().optional().default(''),
    senderId: z.string().optional().default('GYMTC'),
  }).optional(),
  whatsappGateway: z.object({
    enabled: z.boolean().default(false),
    provider: z.enum(['META_CLOUD_API', 'TWILIO', 'GUPSHUP', 'CUSTOM']).default('META_CLOUD_API'),
    accessToken: z.string().optional().default(''),
    phoneNumberId: z.string().optional().default(''),
    businessAccountId: z.string().optional().default(''),
  }).optional(),
});
export type PlatformCommunicationsConfig = z.infer<typeof PlatformCommunicationsConfigSchema>;

export const TopUpCreditsRequestSchema = z.object({
  gymId: z.number().int().positive(),
  channel: z.enum(['sms', 'whatsapp', 'email']),
  credits: z.number().int().min(1),
});
export type TopUpCreditsRequest = z.infer<typeof TopUpCreditsRequestSchema>;

export const SendNotificationRequestSchema = z.object({
  recipientPhone: z.string().min(10),
  recipientName: z.string().min(1),
  channel: z.enum(['SMS', 'WHATSAPP']),
  type: z.enum(['WELCOME', 'PAYMENT_RECEIPT', 'EXPIRY_REMINDER', 'CUSTOM']),
  customMessage: z.string().optional(),
  params: z.record(z.union([z.string(), z.number()])).optional(),
});
export type SendNotificationRequest = z.infer<typeof SendNotificationRequestSchema>;

export const NotificationSettingsRequestSchema = z.object({
  reminderDays: z.number().int().min(1).max(30),
  welcomeEnabled: z.boolean(),
  receiptEnabled: z.boolean(),
  expiryEnabled: z.boolean(),
});
export type NotificationSettingsRequest = z.infer<typeof NotificationSettingsRequestSchema>;

export interface ChannelBalance {
  total: number;
  used: number;
  remaining: number;
}

// ==========================================
// 11. COMMUNICATIONS / SMS / WHATSAPP LOGS
// ==========================================

export const CommunicationLogRowSchema = z.object({
  id: z.number().int().positive(),
  gymId: z.number().int().positive(),
  channel: z.enum(['SMS', 'WHATSAPP', 'EMAIL']),
  recipientPhone: z.string().nullable(),
  recipientName: z.string().nullable(),
  messageType: z.string(),
  creditsDeducted: z.number().int().min(0),
  remainingBalance: z.number().int().min(0),
  dispatchedById: z.number().int().positive().nullable(),
  ip: z.string().nullable(),
  createdAt: z.number().int().positive(),
  lawfulBasis: z.string().nullable(),
  retentionUntil: z.number().int().positive().nullable(),
});
export type CommunicationLogRow = z.infer<typeof CommunicationLogRowSchema>;

export const CommunicationLogsListResponseSchema = z.object({
  logs: z.array(CommunicationLogRowSchema),
  total: z.number().int().min(0),
  limit: z.number().int().positive(),
  offset: z.number().int().min(0),
});
export type CommunicationLogsListResponse = z.infer<typeof CommunicationLogsListResponseSchema>;

export interface NotificationSettingsResponse {
  reminderDays: number;
  welcomeEnabled: boolean;
  receiptEnabled: boolean;
  expiryEnabled: boolean;
  smsBalance: ChannelBalance;
  whatsappBalance: ChannelBalance;
  emailServiceStatus: 'ACTIVE' | 'NOT_CONFIGURED';
  smsServiceStatus: 'ACTIVE' | 'NOT_CONFIGURED';
  whatsappServiceStatus: 'ACTIVE' | 'NOT_CONFIGURED';
}

// ==========================================
// 14. DASHBOARD
// ==========================================

export type { DashboardMetrics };

// ==========================================
// 15. PLATFORM ADMIN DASHBOARD
// ==========================================

export interface PlatformOverview {
  totalGyms: number;
  activeGyms: number;
  suspendedGyms: number;
  totalMembers: number;     // aggregated across all gyms
  monthlyRevenue: number;   // platform license fees
  expiringLicenses: License[];
  recentEvents: Array<{ id: number; action: string; gymName: string; createdAt: number }>;
}

// ==========================================
// 16. DYNAMIC FEATURE PERMISSIONS & AUDIT
// ==========================================

export const UpdateGymFeaturesRequestSchema = z.object({
  features: z.record(z.boolean()),
});
export type UpdateGymFeaturesRequest = z.infer<typeof UpdateGymFeaturesRequestSchema>;

export const UpdateLicenseLimitsRequestSchema = z.object({
  maxMembers: z.number().int().optional(),
  maxOwners: z.number().int().optional(),
  maxManagers: z.number().int().optional(),
  maxStaffTotal: z.number().int().optional(),
  expiresAt: z.number().int().optional(),
  pricePaise: z.number().int().optional(),
  billingPeriod: z.enum(['MONTHLY', 'YEARLY']).optional(),
});
export type UpdateLicenseLimitsRequest = z.infer<typeof UpdateLicenseLimitsRequestSchema>;

export const AdminUserUpdateRequestSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(['OWNER', 'MANAGER']).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  password: z.string().min(6).optional(),
});
export type AdminUserUpdateRequest = z.infer<typeof AdminUserUpdateRequestSchema>;

export const RestoreRecordRequestSchema = z.object({
  reason: z.string().optional(),
});
export type RestoreRecordRequest = z.infer<typeof RestoreRecordRequestSchema>;

// ==========================================
// 15. PLATFORM ADMIN — ROLES & MENUS
// ==========================================

export const MenuGroupSchema = z.object({
  id: z.number().int().positive(),
  key: z.string(),
  label: z.string(),
  icon: z.string(),
  order: z.number().int(),
  isActive: z.boolean(),
});
export type MenuGroup = z.infer<typeof MenuGroupSchema>;

export const MenuItemSchema = z.object({
  id: z.number().int().positive(),
  groupKey: z.string(),
  key: z.string(),
  label: z.string(),
  href: z.string().nullable(),
  icon: z.string().nullable(),
  order: z.number().int(),
  permissions: z.array(z.string()),
  featureKey: z.string().nullable(),
  adminOnly: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});
export type MenuItem = z.infer<typeof MenuItemSchema>;

export const PlatformRoleSchema = z.object({
  id: z.number().int().positive(),
  gymId: z.number().int().positive(),
  name: z.string(),
  permissions: z.array(z.string()),
  isDefault: z.boolean(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  deletedAt: z.number().int().positive().nullable(),
});
export type PlatformRole = z.infer<typeof PlatformRoleSchema>;

export const AdminRoleListResponseSchema = z.object({
  roles: z.array(PlatformRoleSchema),
});
export type AdminRoleListResponse = z.infer<typeof AdminRoleListResponseSchema>;

export const AdminMenuGroupsResponseSchema = z.object({
  groups: z.array(MenuGroupSchema),
});
export type AdminMenuGroupsResponse = z.infer<typeof AdminMenuGroupsResponseSchema>;

export const AdminMenuItemsResponseSchema = z.object({
  items: z.array(MenuItemSchema),
});
export type AdminMenuItemsResponse = z.infer<typeof AdminMenuItemsResponseSchema>;

export const CreateMenuGroupRequestSchema = z.object({
  key: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  icon: z.string().default('Folder'),
  order: z.number().int().default(0),
});
export type CreateMenuGroupRequest = z.infer<typeof CreateMenuGroupRequestSchema>;

export const UpdateMenuGroupRequestSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  icon: z.string().optional(),
  order: z.number().int().optional(),
});
export type UpdateMenuGroupRequest = z.infer<typeof UpdateMenuGroupRequestSchema>;

export const CreateMenuItemRequestSchema = z.object({
  groupKey: z.string().min(1),
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
  href: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().int().default(0),
  permissions: z.array(z.string()).default([]),
  featureKey: z.string().optional(),
  adminOnly: z.boolean().default(false),
});
export type CreateMenuItemRequest = z.infer<typeof CreateMenuItemRequestSchema>;

export const UpdateMenuItemRequestSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  href: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  order: z.number().int().optional(),
  permissions: z.array(z.string()).optional(),
  featureKey: z.string().optional().nullable(),
  adminOnly: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateMenuItemRequest = z.infer<typeof UpdateMenuItemRequestSchema>;

// Platform user management
export const PlatformUserSchema = z.object({
  id: z.number().int().positive(),
  gymId: z.number().int().positive(),
  gymName: z.string().nullable(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  roleId: z.number().int().nullable(),
  roleName: z.string().nullable(),
  role: z.string(),
  status: z.enum(['ACTIVE', 'DISABLED']),
  isOwner: z.boolean(),
  lastLoginAt: z.number().int().nullable(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  disabledAt: z.number().int().nullable(),
});
export type PlatformUser = z.infer<typeof PlatformUserSchema>;

export const PlatformUserListResponseSchema = z.object({
  users: z.array(PlatformUserSchema),
  total: z.number().int().min(0),
});
export type PlatformUserListResponse = z.infer<typeof PlatformUserListResponseSchema>;

export const UpdateUserRoleRequestSchema = z.object({
  roleId: z.number().int().positive().nullable(),
});
export type UpdateUserRoleRequest = z.infer<typeof UpdateUserRoleRequestSchema>;

export const AdminRoleSchema = z.object({
  id: z.number().int().positive(),
  gymId: z.number().int().positive(),
  name: z.string(),
  permissions: z.array(z.string()),
  isDefault: z.boolean(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});
export type AdminRole = z.infer<typeof AdminRoleSchema>;

export const AdminRoleResponseSchema = z.object({
  id: z.number().int().positive(),
  gymId: z.number().int().positive(),
  name: z.string(),
  permissions: z.array(z.string()),
  isDefault: z.boolean(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  deletedAt: z.number().int().positive().nullable(),
});
export type AdminRoleResponse = z.infer<typeof AdminRoleResponseSchema>;

