/**
 * Shared types for the GymTech API + Web.
 *
 * v3 multi-tenant schema:
 *   - Numeric primary keys (INTEGER).
 *   - TEXT enums (legend lives in @gymtech/shared/constants).
 *   - All money in integer paise (₹1 = 100 paise).
 *   - All timestamps in unix seconds.
 *   - Dates like `attendance_date` are stored as YYYYMMDD integers for
 *     fast equality comparisons.
 *
 * The wire format mirrors the D1 row exactly so repository methods can return
 * raw query results without an additional mapping layer.
 */

import type {
  UserRole,
  GymStatus,
  LicenseStatus,
  MemberStatus,
  MembershipStatus,
  PaymentType,
  PaymentMode,
  PaymentStatus,
  AttendanceMethod,
  Gender,
  BillingPeriod,
  CommissionStatus,
  GymFeatureKey,
} from './constants';

export type {
  UserRole,
  GymStatus,
  LicenseStatus,
  MemberStatus,
  MembershipStatus,
  PaymentType,
  PaymentMode,
  PaymentStatus,
  AttendanceMethod,
  Gender,
  BillingPeriod,
  CommissionStatus,
  GymFeatureKey,
};

export interface GymFeature {
  gymId: number;
  featureKey: GymFeatureKey;
  isEnabled: number;
  updatedAt: number;
}

export interface CommunicationLog {
  id: number;
  gymId: number;
  channel: 'SMS' | 'WHATSAPP' | 'EMAIL';
  recipientPhone: string | null;
  recipientName: string | null;
  messageType: string;
  creditsDeducted: number;
  remainingBalance: number;
  dispatchedById: number | null;
  ip: string | null;
  createdAt: number;
}

// =====================================================
// Wire types (mirror the D1 row shape exactly)
// =====================================================

export interface PlatformAdmin {
  id: number
  email: string
  passwordHash: string
  name: string
  status: 'ACTIVE' | 'DISABLED'
  lastLoginAt: number | null
  failedLoginCount: number
  lockedUntil: number | null
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface Gym {
  id: number
  name: string
  slug: string
  phone: string
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  gstNumber: string | null
  currency: string
  logoUrl: string | null
  status: GymStatus
  notificationSettingsJson: string | null
  enabledFeatures?: GymFeatureKey[]
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

/**
 * Plan metadata lives on the license row directly (no separate `saas_plans` table).
 * Each gym has exactly one row, so the schema is naturally per-tenant.
 */
export interface License {
  id: number
  gymId: number
  name: string
  code: string
  pricePaise: number
  billingPeriod: BillingPeriod
  maxMembers: number
  maxOwners: number
  maxManagers: number
  maxStaffTotal: number
  maxSms: number
  maxWhatsapp: number
  maxEmail: number
  smsUsed: number
  whatsappUsed: number
  emailUsed: number
  features: string
  startedAt: number
  expiresAt: number
  status: LicenseStatus
  createdByAdminId: number | null
  createdAt: number
  updatedAt: number
}

export interface User {
  id: number
  gymId: number
  name: string
  email: string
  phone: string | null
  passwordHash: string
  roleId: number | null
  role: string // legacy display string (e.g. 'STAFF', 'OWNER'); use roleId for permissions
  status: 'ACTIVE' | 'DISABLED'
  permissions: string
  isOwner: boolean
  lastLoginAt: number | null
  failedLoginCount: number
  lockedUntil: number | null
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface GymSettings {
  gymId: number
  settings: string
  updatedByUserId: number | null
  updatedAt: number
}

export interface Role {
  id: number
  gymId: number
  name: string
  permissions: string // JSON array of permission keys
  isDefault: boolean
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

/**
 * Hierarchical menu tree — drives the sidebar navigation.
 * Each node may have children (sub-menu items grouped under a parent).
 * PLATFORM_ADMIN sees all items regardless of permissions.
 * Owners (isOwner) see all items regardless of role permissions.
 */
export interface MenuNode {
  /** Unique key for the menu item (used as React key + for permission checks). */
  key: string
  /** Display label shown in the sidebar. */
  label: string
  /** Route path. Leave empty for separator/group nodes (non-link parents). */
  href?: string
  /** Lucide icon component name (string). Resolved in the sidebar renderer. */
  icon?: string
  /** Permission keys the user must have ALL of to see this item. */
  permissions: string[]
  /** Child items — renders as a collapsible sub-menu. */
  children?: MenuNode[]
  /** Shortcut keyboard hint (e.g. '1', '2'). */
  shortcut?: string
  /** Gym feature key required (e.g. 'pt_collections'). If set, gym must have it enabled. */
  featureKey?: GymFeatureKey
  /** Admin-only item — hidden for regular gym users. */
  adminOnly?: boolean
}

export interface GymMembershipPlan {
  id: number
  gymId: number
  name: string
  description: string | null
  durationMonths: number
  pricePaise: number
  admissionFeePaise: number
  taxPercentage: number
  isActive: 1 | 0
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface Member {
  id: number
  gymId: number
  memberCode: string
  firstName: string
  lastName: string | null
  email: string | null
  phone: string
  gender: Gender
  dateOfBirth: number | null
  photoUrl: string | null
  faceEmbedding: string | null
  address: string | null
  city: string | null
  pincode: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  healthNotes: string | null
  status: MemberStatus
  joinedDate: number
  createdAt: number
  updatedAt: number
  deletedAt: number | null
  biometricConsentGiven?: number
  biometricConsentAt?: number | null
  biometricConsentVersion?: string | null
}

export interface Membership {
  id: number
  gymId: number
  memberId: number
  membershipPlanId: number
  startDate: number
  endDate: number
  totalAmountPaise: number
  discountPaise: number
  finalAmountPaise: number
  paidAmountPaise: number
  dueAmountPaise: number
  status: MembershipStatus
  frozenAt: number | null
  notes: string | null
  createdByUserId: number | null
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface Payment {
  id: number
  gymId: number
  memberId: number
  membershipId: number | null
  paymentType: PaymentType
  receiptNumber: string
  amountPaise: number
  paymentDate: number
  paymentMode: PaymentMode
  referenceId: string | null
  status: PaymentStatus
  recordedByUserId: number | null
  notes: string | null
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface PtCollection {
  id: number
  gymId: number
  memberId: number
  trainerId: number
  sessions: number
  amountPaise: number
  commissionPercentage: number
  commissionPaise: number
  commissionStatus: CommissionStatus
  paymentMode: PaymentMode
  paymentDate: number
  receiptNumber: string | null
  notes: string | null
  recordedByUserId: number | null
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface Attendance {
  id: number
  gymId: number
  memberId: number
  checkInTime: number
  attendanceDate: number
  method: AttendanceMethod
  recordedByUserId: number | null
  deviceInfo: string | null
  createdAt: number
}

export interface UserSession {
  id: number
  gymId: number
  userId: number
  tokenHash: string
  ip: string | null
  userAgent: string | null
  issuedAt: number
  expiresAt: number
  revokedAt: number | null
}

export interface UserPasswordReset {
  id: number
  gymId: number
  userId: number
  tokenHash: string
  expiresAt: number
  usedAt: number | null
  createdAt: number
}

export interface AuditEvent {
  id: number
  gymId: number
  actorUserId: number | null
  actorRole: UserRole | null
  action: string
  entityType: string
  entityId: number | null
  beforeState: string | null
  afterState: string | null
  ip: string | null
  userAgent: string | null
  deviceInfo: string | null
  metadata: string | null
  createdAt: number
}

export interface SaasAuditEvent {
  id: number
  actorAdminId: number
  affectedGymId: number | null
  action: string
  entityType: string | null
  entityId: number | null
  beforeState: string | null
  afterState: string | null
  ip: string | null
  userAgent: string | null
  metadata: string | null
  createdAt: number
}

// =====================================================
// Session user (the JWT payload — id and gym_id are NUMBERS now)
// =====================================================

export interface SessionUser {
  id: number
  email: string
  name: string
  role: UserRole
  gymId: number | null
  /** True for the gym's primary owner account */
  isOwner: boolean
  /** Menu permission keys granted to this user (e.g. dashboard, members, attendance …) */
  permissions: string[]
  /** FK to the gym's custom role */
  roleId: number | null
  /** jti of the current access token — used for server-side session revocation */
  jti?: string
}

// =====================================================
// Joined / computed shapes (for the frontend's convenience)
// =====================================================

export interface MemberListItem extends Member {
  active_membership_id: number | null
  membership_status: MembershipStatus | null
  membership_start_date: number | null
  membership_end_date: number | null
  membership_due_amount_paise: number | null
  plan_name: string | null
}

export interface PaymentWithDetails extends Payment {
  firstName: string
  lastName: string | null
  memberCode: string
  phone: string
  recordedByName: string | null
}

export interface AttendanceListItem extends Attendance {
  firstName: string
  lastName: string | null
  memberCode: string
  phone: string
  photoUrl: string | null
}

export interface ExpiringMember {
  id: number
  firstName: string
  lastName: string | null
  phone: string
  planName: string | null
  endDate: number
  dueAmountPaise: number
  whatsappUrl?: string
}

export interface DashboardMetrics {
  activeMembers: number
  todayAttendance: number
  monthlyRevenue: number
  pendingDues: number
  expiringSoon: ExpiringMember[]
  recentPayments: Payment[]
  todayCheckIns?: AttendanceListItem[]
  weeklyAttendance?: { day: string; date: string; count: number; avg: number }[]
  monthlyRevenueTrend?: { month: string; revenue: number; renewals: number; newJoins: number; monthlyRevenue: number; yearlyRevenue: number }[]
  atRiskMembers?: {
    id: number
    name: string
    phone: string
    plan: string
    daysInactive: number
    lastCheckIn: string
    riskLevel: 'HIGH' | 'MEDIUM'
  }[]
  planDistribution?: { name: string; memberCount: number; revenue: number }[]
}

// =====================================================
// Wire shapes for endpoints that don't have a full table
// =====================================================

export interface PtCollectionRow extends PtCollection {
  memberName: string
  memberCode: string
  trainerName: string | null
}

export interface PtSummary {
  totalCollected: number
  totalCommissionPending: number
  totalCommissionPaid: number
  byTrainer: Array<{
    trainerId: number
    trainerName: string
    collections: number
    collected: number
    commissionPending: number
    commissionPaid: number
  }>
}

export interface InvoiceData {
  receiptNumber: string
  paymentDate: number
  paymentMode: PaymentMode
  referenceId: string | null
  status: PaymentStatus
  gym: {
    name: string
    address: string | null
    city: string | null
    state: string | null
    pincode: string | null
    phone: string
    email: string | null
    gstNumber: string | null
  }
  member: {
    name: string
    memberCode: string
    phone: string
  }
  planName: string | null
  sacCode: string
  amount: number
  taxPercentage: number
  taxableAmount: number
  taxAmount: number
  cgst: number
  sgst: number
  notes: string | null
}
