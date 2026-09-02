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

export const USER_ROLES = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  STAFF: 'STAFF',
  TRAINER: 'TRAINER',
  MEMBER: 'MEMBER',
} as const;

export const USER_ROLE_NUMERIC: Record<string, number> = {
  PLATFORM_ADMIN: 0,
  OWNER: 1,
  MANAGER: 2,
  STAFF: 3,
  TRAINER: 4,
  MEMBER: 5,
};

export const NUMERIC_USER_ROLE: Record<number, string> = {
  0: 'PLATFORM_ADMIN',
  1: 'OWNER',
  2: 'MANAGER',
  3: 'STAFF',
  4: 'TRAINER',
  5: 'MEMBER',
};

export const GYM_STATUSES = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
} as const;

export const GYM_STATUS_NUMERIC: Record<string, number> = {
  ACTIVE: 1,
  SUSPENDED: 2,
  CANCELLED: 3,
};

export const NUMERIC_GYM_STATUS: Record<number, string> = {
  1: 'ACTIVE',
  2: 'SUSPENDED',
  3: 'CANCELLED',
};

export const LICENSE_STATUSES = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  SUSPENDED: 'SUSPENDED',
} as const;

export const LICENSE_STATUS_NUMERIC: Record<string, number> = {
  ACTIVE: 1,
  EXPIRED: 2,
  SUSPENDED: 3,
};

export const NUMERIC_LICENSE_STATUS: Record<number, string> = {
  1: 'ACTIVE',
  2: 'EXPIRED',
  3: 'SUSPENDED',
};

export const MEMBER_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED',
  EXPIRED: 'EXPIRED',
  FROZEN: 'FROZEN',
  CANCELLED: 'CANCELLED',
} as const;

export const MEMBER_STATUS_NUMERIC: Record<string, number> = {
  ACTIVE: 1,
  INACTIVE: 2,
  BLOCKED: 3,
  EXPIRED: 4,
  FROZEN: 5,
};

export const NUMERIC_MEMBER_STATUS: Record<number, string> = {
  1: 'ACTIVE',
  2: 'INACTIVE',
  3: 'BLOCKED',
  4: 'EXPIRED',
  5: 'FROZEN',
};

export const MEMBERSHIP_STATUSES = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  FROZEN: 'FROZEN',
  CANCELLED: 'CANCELLED',
} as const;

export const MEMBERSHIP_STATUS_NUMERIC: Record<string, number> = {
  ACTIVE: 1,
  EXPIRED: 2,
  FROZEN: 3,
  CANCELLED: 4,
};

export const NUMERIC_MEMBERSHIP_STATUS: Record<number, string> = {
  1: 'ACTIVE',
  2: 'EXPIRED',
  3: 'FROZEN',
  4: 'CANCELLED',
};

export const PAYMENT_TYPES = {
  GYM: 'GYM',
  PERSONAL_TRAINING: 'PERSONAL_TRAINING',
} as const;

export const PAYMENT_TYPE_NUMERIC: Record<string, number> = {
  GYM: 1,
  PERSONAL_TRAINING: 2,
};

export const PAYMENT_MODES = {
  CASH: 'CASH',
  UPI: 'UPI',
  CARD: 'CARD',
  BANK_TRANSFER: 'BANK_TRANSFER',
  OTHER: 'OTHER',
} as const;

export const PAYMENT_MODE_NUMERIC: Record<string, number> = {
  CASH: 1,
  UPI: 2,
  CARD: 3,
  BANK_TRANSFER: 4,
  OTHER: 5,
};

export const NUMERIC_PAYMENT_MODE: Record<number, string> = {
  1: 'CASH',
  2: 'UPI',
  3: 'CARD',
  4: 'BANK_TRANSFER',
  5: 'OTHER',
};

export const PAYMENT_STATUSES = {
  COMPLETED: 'COMPLETED',
  REFUNDED: 'REFUNDED',
  VOID: 'VOID',
} as const;

export const PAYMENT_STATUS_NUMERIC: Record<string, number> = {
  COMPLETED: 1,
  REFUNDED: 2,
  VOID: 3,
};

export const ATTENDANCE_METHODS = {
  MANUAL: 'MANUAL',
  QR: 'QR',
  FACE_ID: 'FACE_ID',
} as const;

export const ATTENDANCE_METHOD_NUMERIC: Record<string, number> = {
  MANUAL: 1,
  QR: 2,
  FACE_ID: 3,
};

export const GENDERS = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
} as const;

export const GENDER_NUMERIC: Record<string, number> = {
  MALE: 1,
  FEMALE: 2,
  OTHER: 3,
};

export const BILLING_PERIODS = {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
} as const;

export const BILLING_PERIOD_NUMERIC: Record<string, number> = {
  MONTHLY: 1,
  YEARLY: 2,
};

export const COMMISSION_STATUSES = {
  PENDING: 'PENDING',
  PAID: 'PAID',
} as const;

export const COMMISSION_STATUS_NUMERIC: Record<string, number> = {
  PENDING: 1,
  PAID: 2,
};

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
};

