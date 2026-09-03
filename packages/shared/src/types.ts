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
  gym_id: number;
  feature_key: GymFeatureKey;
  is_enabled: number;
  updated_at: number;
}

export interface CommunicationLog {
  id: number;
  gym_id: number;
  channel: 'SMS' | 'WHATSAPP' | 'EMAIL';
  recipient_phone: string | null;
  recipient_name: string | null;
  message_type: string;
  credits_deducted: number;
  remaining_balance: number;
  dispatched_by_id: number | null;
  ip: string | null;
  created_at: number;
}

// =====================================================
// Wire types (mirror the D1 row shape exactly)
// =====================================================

export interface PlatformAdmin {
  id: number
  email: string
  password_hash: string
  password_algo: 'sha256' | 'argon2id'
  name: string
  status: 'ACTIVE' | 'DISABLED'
  last_login_at: number | null
  failed_login_count: number
  locked_until: number | null
  created_at: number
  updated_at: number
  deleted_at: number | null
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
  gst_number: string | null
  currency: string
  logo_url: string | null
  status: GymStatus
  notification_settings_json: string | null
  enabled_features?: GymFeatureKey[]
  created_at: number
  updated_at: number
  deleted_at: number | null
}

/**
 * Plan metadata lives on the license row directly (no separate `saas_plans` table).
 * Each gym has exactly one row, so the schema is naturally per-tenant.
 */
export interface License {
  id: number
  gym_id: number
  name: string              // "Professional"
  code: string              // "PRO"
  price_paise: number       // what this gym pays
  billing_period: BillingPeriod
  max_members: number       // -1 = unlimited
  max_owners: number
  max_managers: number
  max_staff_total: number
  max_sms: number
  max_whatsapp: number
  max_email: number
  sms_used: number
  whatsapp_used: number
  email_used: number
  features: string          // JSON
  started_at: number
  expires_at: number
  status: LicenseStatus
  created_by_admin_id: number | null
  created_at: number
  updated_at: number
}

export interface User {
  id: number
  gym_id: number
  name: string
  email: string
  phone: string | null
  password_hash: string
  password_algo: 'sha256' | 'argon2id'
  role: UserRole
  status: 'ACTIVE' | 'DISABLED'
  permissions: string       // JSON
  last_login_at: number | null
  failed_login_count: number
  locked_until: number | null
  created_at: number
  updated_at: number
  deleted_at: number | null
}

export interface GymSettings {
  gym_id: number
  settings: string          // JSON
  updated_by_user_id: number | null
  updated_at: number
}

export interface GymMembershipPlan {
  id: number
  gym_id: number
  name: string
  description: string | null
  duration_months: number
  price_paise: number
  admission_fee_paise: number
  tax_percentage: number
  is_active: 1 | 0
  created_at: number
  updated_at: number
  deleted_at: number | null
}

export interface Member {
  id: number
  gym_id: number
  member_code: string
  first_name: string
  last_name: string | null
  email: string | null
  phone: string
  gender: Gender
  date_of_birth: number | null
  photo_url: string | null
  face_embedding: string | null
  address: string | null
  city: string | null
  pincode: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  health_notes: string | null
  status: MemberStatus
  joined_date: number
  created_at: number
  updated_at: number
  deleted_at: number | null
  // Phase 4.1: Biometric consent
  biometric_consent_given?: number // 0 or 1
  biometric_consent_at?: number | null
  biometric_consent_version?: string | null
}

export interface Membership {
  id: number
  gym_id: number
  member_id: number
  membership_plan_id: number
  start_date: number
  end_date: number
  total_amount_paise: number
  discount_paise: number
  final_amount_paise: number
  paid_amount_paise: number
  due_amount_paise: number
  status: MembershipStatus
  frozen_at: number | null
  notes: string | null
  created_by_user_id: number | null
  created_at: number
  updated_at: number
  deleted_at: number | null
}

export interface Payment {
  id: number
  gym_id: number
  member_id: number
  membership_id: number | null
  payment_type: PaymentType
  receipt_number: string
  amount_paise: number
  payment_date: number
  payment_mode: PaymentMode
  reference_id: string | null
  status: PaymentStatus
  recorded_by_user_id: number | null
  notes: string | null
  created_at: number
  updated_at: number
  deleted_at: number | null
}

export interface PtCollection {
  id: number
  gym_id: number
  member_id: number
  trainer_id: number
  sessions: number
  amount_paise: number
  commission_percentage: number
  commission_paise: number
  commission_status: CommissionStatus
  payment_mode: PaymentMode
  payment_date: number
  receipt_number: string | null
  notes: string | null
  recorded_by_user_id: number | null
  created_at: number
  updated_at: number
  deleted_at: number | null
}

export interface Attendance {
  id: number
  gym_id: number
  member_id: number
  check_in_time: number
  check_out_time: number | null
  attendance_date: number    // YYYYMMDD
  method: AttendanceMethod
  recorded_by_user_id: number | null
  device_info: string | null
  created_at: number
}

export interface UserSession {
  id: number
  gym_id: number
  user_id: number
  token_hash: string
  ip: string | null
  user_agent: string | null
  issued_at: number
  expires_at: number
  revoked_at: number | null
}

export interface UserPasswordReset {
  id: number
  gym_id: number
  user_id: number
  token_hash: string
  expires_at: number
  used_at: number | null
  created_at: number
}

export interface AuditEvent {
  id: number
  gym_id: number
  actor_user_id: number | null
  actor_role: UserRole | null
  action: string
  entity_type: string
  entity_id: number | null
  before_state: string | null
  after_state: string | null
  ip: string | null
  user_agent: string | null
  device_info: string | null
  metadata: string | null
  created_at: number
}

export interface SaasAuditEvent {
  id: number
  actor_admin_id: number
  affected_gym_id: number | null
  action: string
  entity_type: string | null
  entity_id: number | null
  before_state: string | null
  after_state: string | null
  ip: string | null
  user_agent: string | null
  metadata: string | null
  created_at: number
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
  first_name: string
  last_name: string | null
  member_code: string
  phone: string
  recorded_by_name: string | null
}

export interface AttendanceListItem extends Attendance {
  first_name: string
  last_name: string | null
  member_code: string
  phone: string
  photo_url: string | null
}

export interface ExpiringMember {
  id: number
  first_name: string
  last_name: string | null
  phone: string
  plan_name: string | null
  end_date: number
  due_amount_paise: number
  whatsapp_url?: string
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
  monthlyRevenueTrend?: { month: string; revenue: number; renewals: number; newJoins: number }[]
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
  member_name: string
  member_code: string
  trainer_name: string | null
}

export interface PtSummary {
  totalCollected: number
  totalCommissionPending: number
  totalCommissionPaid: number
  byTrainer: Array<{
    trainer_id: number
    trainer_name: string
    collections: number
    collected: number
    commission_pending: number
    commission_paid: number
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
