/**
 * Shared constants for the GymTech API + Web.
 *
 * The backend persists enums as integers (see `*_NUMERIC` blocks below).
 * The frontend still uses the human-friendly string labels so the UI keeps
 * working. Mapping helpers live at the bottom of this file.
 */

// =====================================================
// STRING LABELS (used by the frontend & Zod schemas)
// =====================================================

// The ONE role vocabulary. The API derives its built-in role list from this
// (`lib/roles.ts`), so backend policy, contracts and UI can never disagree
// about which role names exist. Gym-defined custom roles are rows in `roles`
// and deliberately are not part of this list — they map onto STAFF plus their
// own permission keys.
export const USER_ROLES = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN', // platform operator, not a tenant user
  OWNER: 'OWNER', // the gym's primary owner (users.is_owner / roles.is_owner)
  MANAGER: 'MANAGER',
  STAFF: 'STAFF',
  TRAINER: 'TRAINER',
  MEMBER: 'MEMBER', // member portal
} as const;


export const GYM_STATUSES = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
} as const;


export const LICENSE_STATUSES = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  SUSPENDED: 'SUSPENDED',
} as const;


export const MEMBER_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED',
  EXPIRED: 'EXPIRED',
  FROZEN: 'FROZEN',
  CANCELLED: 'CANCELLED',
} as const;


export const MEMBERSHIP_STATUSES = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  FROZEN: 'FROZEN',
  CANCELLED: 'CANCELLED',
} as const;


export const PAYMENT_TYPES = {
  GYM: 'GYM',
  PERSONAL_TRAINING: 'PERSONAL_TRAINING',
} as const;


export const PAYMENT_MODES = {
  CASH: 'CASH',
  UPI: 'UPI',
  CARD: 'CARD',
  BANK_TRANSFER: 'BANK_TRANSFER',
  OTHER: 'OTHER',
} as const;


export const PAYMENT_STATUSES = {
  COMPLETED: 'COMPLETED',
  REFUNDED: 'REFUNDED',
  VOID: 'VOID',
} as const;


export const ATTENDANCE_METHODS = {
  MANUAL: 'MANUAL',
  QR: 'QR',
  FACE_ID: 'FACE_ID',
} as const;


export const GENDERS = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
} as const;


export const BILLING_PERIODS = {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
} as const;


export const COMMISSION_STATUSES = {
  PENDING: 'PENDING',
  PAID: 'PAID',
} as const;


// =====================================================
// Display labels (for the UI)
// =====================================================

export const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'> = {
  ACTIVE: 'success',
  COMPLETED: 'success',
  PAID: 'success',
  INACTIVE: 'secondary',
  EXPIRED: 'warning',
  FROZEN: 'info',
  PENDING: 'warning',
  SUSPENDED: 'destructive',
  BLOCKED: 'destructive',
  CANCELLED: 'secondary',
  REFUNDED: 'outline',
  VOID: 'destructive',
};

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  BLOCKED: 'Blocked',
  EXPIRED: 'Expired',
  FROZEN: 'Frozen',
  CANCELLED: 'Cancelled',
  SUSPENDED: 'Suspended',
  PENDING: 'Pending',
  PAID: 'Paid',
  COMPLETED: 'Completed',
  REFUNDED: 'Refunded',
  VOID: 'Void',
};

// =====================================================
// Defaults
// =====================================================

export const DEFAULT_REMINDER_DAYS = 7;
export const DEFAULT_PAGINATION_LIMIT = 50;
export const MAX_PAGINATION_LIMIT = 200;
export const DEFAULT_LICENSE_PERIOD_DAYS = 30;
export const PT_COLLECTION_RECEIPT_PREFIX = 'PT-';

// =====================================================
// Currencies (frontend hint)
// =====================================================

export const SUPPORTED_CURRENCIES = ['INR'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

// =====================================================
// String-union types (re-exported from the const objects above)
// =====================================================

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export type GymStatus = (typeof GYM_STATUSES)[keyof typeof GYM_STATUSES];
export type LicenseStatus = (typeof LICENSE_STATUSES)[keyof typeof LICENSE_STATUSES];
export type MemberStatus = (typeof MEMBER_STATUSES)[keyof typeof MEMBER_STATUSES];
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[keyof typeof MEMBERSHIP_STATUSES];
export type PaymentType = (typeof PAYMENT_TYPES)[keyof typeof PAYMENT_TYPES];
export type PaymentMode = (typeof PAYMENT_MODES)[keyof typeof PAYMENT_MODES];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];
export type AttendanceMethod = (typeof ATTENDANCE_METHODS)[keyof typeof ATTENDANCE_METHODS];
export type Gender = (typeof GENDERS)[keyof typeof GENDERS] | null;
export type BillingPeriod = (typeof BILLING_PERIODS)[keyof typeof BILLING_PERIODS];
export type CommissionStatus = (typeof COMMISSION_STATUSES)[keyof typeof COMMISSION_STATUSES];

// =====================================================
// Centralized Feature Catalog
// =====================================================
// One key per shipped product area. A gym's enabled keys live in
// `licenses.features` (JSON) and gate both the API (`requireFeature`) and
// the sidebar/platform-admin feature toggles.
// An EMPTY feature map means "all features enabled" (legacy/default license).
export const GYM_FEATURES = [
  'dashboard',
  'members',
  'attendance',
  'payments',
  'pt_collections',
  'plans',
  'staff',
  'reports',
  'settings',
  'audit_logs',
] as const;

export type GymFeatureKey = (typeof GYM_FEATURES)[number];

export const GYM_FEATURE_LABELS: Record<GymFeatureKey, { name: string; description: string }> = {
  dashboard: { name: 'Dashboard', description: 'Overview metrics & operational KPIs' },
  members: { name: 'Members Directory', description: 'Member registration, lifecycle & digital passes' },
  attendance: { name: 'Floor & Attendance', description: 'Real-time check-in, reticle HUD & Face ID' },
  payments: { name: 'Payments & Billing', description: 'POS invoicing, fee collection & receipts' },
  pt_collections: { name: 'PT Collections', description: 'Personal trainer sessions & commission splits' },
  plans: { name: 'Membership Plans', description: 'Plan catalog, pricing & durations' },
  staff: { name: 'Staff Management', description: 'Owner and Manager account provisioning' },
  reports: { name: 'Financial Reports', description: 'Revenue breakdowns, collection trends & analytics' },
  settings: { name: 'Notification Settings', description: 'WhatsApp & SMS triggers and message balances' },
  audit_logs: { name: 'Audit Logs', description: 'Audit trail of all gym data changes' },
};

