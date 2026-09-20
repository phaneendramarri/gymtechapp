// filepath: apps/api/src/db/schema.ts
/**
 * Drizzle schema — TypeScript mirror of the canonical SQL baseline in `apps/api/migrations/0000_init.sql`.
 *
 * This file describes the 31 tables that the application uses across 7 cohesive domains.
 * Tables with no routes/services/repositories behind them were removed.
 *
 * Conventions (kept invariant across the whole schema):
 *   - All money columns end in `_paise` (INTEGER paise; ₹1 = 100 paise).
 *   - All timestamps are unix seconds (INTEGER).
 *   - `attendance_date` is YYYYMMDD INTEGER (fast range scans).
 *   - Every tenant-owned table carries `gym_id`, and composite
 *     `(gym_id, id)` foreign keys mirror the DB-level tenant invariants.
 *   - Any parent referenced by a composite FK MUST expose a UNIQUE index on
 *     the referenced columns, otherwise SQLite raises "foreign key mismatch".
 */
import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text, real, uniqueIndex, index, primaryKey, foreignKey } from 'drizzle-orm/sqlite-core';

// ============================================================
// 1. platform_admins (platform-level operators, not tenant users)
// ============================================================
export const platformAdmins = sqliteTable('platform_admins', {
  id: integer('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  status: text('status', { enum: ['ACTIVE', 'DISABLED'] }).notNull().default('ACTIVE'),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: integer('locked_until'),
  lastLoginAt: integer('last_login_at'),
  /** JSON array of gym IDs this admin may access; null/empty = full access. */
  authorizedGyms: text('authorized_gyms'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

// ============================================================
// 2. gyms (tenants)
// ============================================================
export const gyms = sqliteTable('gyms', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  phone: text('phone').notNull(),
  email: text('email'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  pincode: text('pincode'),
  gstNumber: text('gst_number'),
  currency: text('currency').notNull().default('INR'),
  logoUrl: text('logo_url'),
  status: text('status', { enum: ['ACTIVE', 'SUSPENDED', 'CANCELLED'] }).notNull().default('ACTIVE'),
  notificationSettingsJson: text('notification_settings_json'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => ({
  statusIdx: index('idx_gyms_status').on(t.status, t.deletedAt),
}));

// ============================================================
// 3. licenses (one commercial license per gym — quotas + feature flags)
// ============================================================
export const licenses = sqliteTable('licenses', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull().unique().references(() => gyms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: text('code').notNull(),
  pricePaise: integer('price_paise').notNull(),
  billingPeriod: text('billing_period', { enum: ['MONTHLY', 'YEARLY'] }).notNull().default('MONTHLY'),
  maxMembers: integer('max_members').notNull(),
  maxOwners: integer('max_owners').notNull().default(1),
  maxManagers: integer('max_managers').notNull(),
  maxStaffTotal: integer('max_staff_total').notNull(),
  maxSms: integer('max_sms').notNull(),
  maxWhatsapp: integer('max_whatsapp').notNull(),
  maxEmail: integer('max_email').notNull(),
  smsUsed: integer('sms_used').notNull().default(0),
  whatsappUsed: integer('whatsapp_used').notNull().default(0),
  emailUsed: integer('email_used').notNull().default(0),
  /**
   * JSON object of feature flags, e.g. {"reports": true, "pt_collections": true}.
   * This is the authoritative source for `requireFeature()` gating; a missing
   * key means the feature is disabled.
   */
  features: text('features').notNull().default('{}'),
  startedAt: integer('started_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  status: text('status', { enum: ['ACTIVE', 'EXPIRED', 'SUSPENDED'] }).notNull().default('ACTIVE'),
  renewalReminderSentAt: integer('renewal_reminder_sent_at'),
  trialEndsAt: integer('trial_ends_at'),
  createdByAdminId: integer('created_by_admin_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  codeUq: uniqueIndex('licenses_code_unique').on(t.code),
}));

// ============================================================
// 4. roles (owner-defined, per-gym; permissions are role-scoped)
// ============================================================
export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** JSON array of permission keys, e.g. ["members","payments"]. */
  permissions: text('permissions').notNull().default('[]'),
  /** True for the gym's primary owner role — grants unrestricted gym access. */
  isOwner: integer('is_owner', { mode: 'boolean' }).notNull().default(false),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => ({
  gymNameUq: uniqueIndex('roles_gym_name_unique').on(t.gymId, t.name),
  gymIdx: index('idx_roles_gym').on(t.gymId, t.deletedAt),
}));

// ============================================================
// 5. users (gym staff/owners; platform admins live in platform_admins)
// ============================================================
export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  passwordHash: text('password_hash').notNull(),
  /**
   * The only role reference. A denormalized role-name column used to live here;
   * it could not represent custom role names (its CHECK constraint rejected
   * them) and could drift from the role it mirrored.
   */
  roleId: integer('role_id').references(() => roles.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['ACTIVE', 'DISABLED'] }).notNull().default('ACTIVE'),
  isOwner: integer('is_owner', { mode: 'boolean' }).notNull().default(false),
  lastLoginAt: integer('last_login_at'),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: integer('locked_until'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => ({
  gymIdUq: uniqueIndex('users_gym_id_unique').on(t.gymId, t.id),
  gymEmailUq: uniqueIndex('users_gym_email_unique').on(t.gymId, t.email),
  gymOwnerIdx: index('idx_users_gym_owner').on(t.gymId, t.isOwner),
  gymStatusIdx: index('idx_users_gym_status').on(t.gymId, t.status, t.deletedAt),
  gymRoleIdx: index('idx_users_gym_role').on(t.gymId, t.roleId),
}));

// ============================================================
// 6. membership_plans (gym-level catalog sold to members)
// ============================================================
export const membershipPlans = sqliteTable('membership_plans', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  durationMonths: integer('duration_months').notNull(),
  pricePaise: integer('price_paise').notNull(),
  admissionFeePaise: integer('admission_fee_paise').notNull().default(0),
  taxPercentage: real('tax_percentage').notNull().default(0),
  isActive: integer('is_active').notNull().default(1),
  /** Revenue bucketing (MONTHLY vs YEARLY billing). */
  billingPeriod: text('billing_period', { enum: ['MONTHLY', 'YEARLY'] }).notNull().default('MONTHLY'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => ({
  // Required parent key for memberships(gym_id, membership_plan_id) FK.
  gymIdUq: uniqueIndex('membership_plans_gym_id_unique').on(t.gymId, t.id),
  gymNameUq: uniqueIndex('membership_plans_gym_name_unique').on(t.gymId, t.name),
  gymActiveIdx: index('idx_membership_plans_gym_active').on(t.gymId, t.isActive, t.deletedAt),
}));

// ============================================================
// 7. members (gym customers)
// ============================================================
export const members = sqliteTable('members', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  memberCode: text('member_code').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name'),
  email: text('email'),
  phone: text('phone').notNull(),
  gender: text('gender', { enum: ['MALE', 'FEMALE', 'OTHER'] }),
  dateOfBirth: integer('date_of_birth'),
  photoUrl: text('photo_url'),
  faceEmbedding: text('face_embedding'),
  /** 0/1 consent flag (kept as INTEGER to match the shared DTO contract). */
  biometricConsentGiven: integer('biometric_consent_given').notNull().default(0),
  biometricConsentAt: integer('biometric_consent_at'),
  biometricConsentVersion: text('biometric_consent_version').default('1.0'),
  address: text('address'),
  city: text('city'),
  pincode: text('pincode'),
  emergencyContactName: text('emergency_contact_name'),
  emergencyContactPhone: text('emergency_contact_phone'),
  healthNotes: text('health_notes'),
  status: text('status', {
    enum: ['ACTIVE', 'INACTIVE', 'BLOCKED', 'EXPIRED', 'FROZEN', 'CANCELLED'],
  }).notNull().default('ACTIVE'),
  joinedDate: integer('joined_date').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => ({
  gymIdUq: uniqueIndex('members_gym_id_unique').on(t.gymId, t.id),
  gymCodeUq: uniqueIndex('members_gym_member_code_unique').on(t.gymId, t.memberCode),
  gymPhoneUq: uniqueIndex('members_gym_phone_unique').on(t.gymId, t.phone),
  gymStatusIdx: index('idx_members_gym_status').on(t.gymId, t.status, t.deletedAt),
  gymNameIdx: index('idx_members_gym_name').on(t.gymId, t.lastName, t.firstName),
}));

// ============================================================
// 8. memberships (a member's instance of a plan)
// ============================================================
export const memberships = sqliteTable('memberships', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  memberId: integer('member_id').notNull(),
  membershipPlanId: integer('membership_plan_id').notNull(),
  startDate: integer('start_date').notNull(),
  endDate: integer('end_date').notNull(),
  totalAmountPaise: integer('total_amount_paise').notNull(),
  discountPaise: integer('discount_paise').notNull().default(0),
  finalAmountPaise: integer('final_amount_paise').notNull(),
  paidAmountPaise: integer('paid_amount_paise').notNull().default(0),
  dueAmountPaise: integer('due_amount_paise').notNull().default(0),
  status: text('status', { enum: ['ACTIVE', 'EXPIRED', 'FROZEN', 'CANCELLED'] }).notNull().default('ACTIVE'),
  frozenAt: integer('frozen_at'),
  notes: text('notes'),
  createdByUserId: integer('created_by_user_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => ({
  gymIdUq: uniqueIndex('memberships_gym_id_unique').on(t.gymId, t.id),
  gymMemberIdx: index('idx_memberships_gym_member').on(t.gymId, t.memberId),
  gymStatusDatesIdx: index('idx_memberships_gym_status_dates').on(t.gymId, t.status, t.endDate),
  gymEndDateIdx: index('idx_memberships_gym_end_date').on(t.gymId, t.endDate),
}));

// ============================================================
// 9. payments (fee receipts; also links PT payments)
// ============================================================
export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  memberId: integer('member_id').notNull(),
  membershipId: integer('membership_id'),
  paymentType: text('payment_type', { enum: ['GYM', 'PERSONAL_TRAINING'] }).notNull().default('GYM'),
  receiptNumber: text('receipt_number').notNull(),
  amountPaise: integer('amount_paise').notNull(),
  paymentDate: integer('payment_date').notNull(),
  paymentMode: text('payment_mode', { enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER'] }).notNull(),
  referenceId: text('reference_id'),
  status: text('status', { enum: ['COMPLETED', 'REFUNDED', 'VOID'] }).notNull().default('COMPLETED'),
  recordedByUserId: integer('recorded_by_user_id'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => ({
  gymReceiptUq: uniqueIndex('payments_gym_receipt_unique').on(t.gymId, t.receiptNumber),
  gymDateIdx: index('idx_payments_gym_date').on(t.gymId, t.paymentDate),
  gymMemberDateIdx: index('idx_payments_gym_member_date').on(t.gymId, t.memberId, t.paymentDate),
  gymStatusDateIdx: index('idx_payments_gym_status_date').on(t.gymId, t.status, t.paymentDate),
}));

// ============================================================
// 10. pt_collections (personal-training sessions + commission)
// ============================================================
export const ptCollections = sqliteTable('pt_collections', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  memberId: integer('member_id').notNull(),
  trainerId: integer('trainer_id').notNull(),
  sessions: integer('sessions').notNull().default(0),
  amountPaise: integer('amount_paise').notNull(),
  commissionPercentage: real('commission_percentage').notNull().default(0),
  commissionPaise: integer('commission_paise').notNull().default(0),
  commissionStatus: text('commission_status', { enum: ['PENDING', 'PAID'] }).notNull().default('PENDING'),
  paymentMode: text('payment_mode', { enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER'] }).notNull().default('CASH'),
  paymentDate: integer('payment_date').notNull(),
  receiptNumber: text('receipt_number'),
  notes: text('notes'),
  recordedByUserId: integer('recorded_by_user_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => ({
  gymDateIdx: index('idx_pt_collections_gym_date').on(t.gymId, t.paymentDate),
  gymTrainerIdx: index('idx_pt_collections_gym_trainer').on(t.gymId, t.trainerId, t.commissionStatus),
  // Partial unique index: receipts are optional, but never duplicated per gym.
  receiptUq: uniqueIndex('pt_collections_gym_receipt_unique')
    .on(t.gymId, t.receiptNumber)
    .where(sql`${t.receiptNumber} IS NOT NULL`),
}));

// ============================================================
// 11. attendance (floor check-ins, soft-deletable)
// ============================================================
export const attendance = sqliteTable('attendance', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  memberId: integer('member_id').notNull(),
  checkInTime: integer('check_in_time').notNull(),
  checkOutTime: integer('check_out_time'),
  /** YYYYMMDD — enables day-range scans without time arithmetic. */
  attendanceDate: integer('attendance_date').notNull(),
  method: text('method', { enum: ['MANUAL', 'QR', 'FACE_ID', 'KIOSK'] }).notNull(),
  recordedByUserId: integer('recorded_by_user_id'),
  deviceInfo: text('device_info'),
  createdAt: integer('created_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => ({
  gymDateIdx: index('idx_attendance_gym_date').on(t.gymId, t.attendanceDate),
  gymMemberDateIdx: index('idx_attendance_gym_member_date').on(t.gymId, t.memberId, t.attendanceDate),
  gymCheckinIdx: index('idx_attendance_gym_checkin').on(t.gymId, t.checkInTime),
}));

// ============================================================
// 12. user_sessions (access + refresh token registry)
// ============================================================
export const userSessions = sqliteTable('user_sessions', {
  id: integer('id').primaryKey(),
  /** Platform-admin sessions are stored with gym_id = 0 (no tenant). */
  gymId: integer('gym_id').notNull().default(0),
  userId: integer('user_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  refreshTokenHash: text('refresh_token_hash'),
  refreshTokenExpiresAt: integer('refresh_token_expires_at'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  issuedAt: integer('issued_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  revokedAt: integer('revoked_at'),
  userType: text('user_type', { enum: ['GYM_USER', 'PLATFORM_ADMIN'] }).notNull().default('GYM_USER'),
}, (t) => ({
  gymUserIdx: index('idx_user_sessions_gym_user').on(t.gymId, t.userId),
  expiresIdx: index('idx_user_sessions_expires').on(t.expiresAt),
}));

// ============================================================
// 13. user_password_resets
// ============================================================
export const userPasswordResets = sqliteTable('user_password_resets', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull(),
  userId: integer('user_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: integer('expires_at').notNull(),
  usedAt: integer('used_at'),
  createdAt: integer('created_at').notNull(),
});

// ============================================================
// 14. audit_events (append-only; platform-admin actions use gym_id = 0)
// ============================================================
export const auditEvents = sqliteTable('audit_events', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull(),
  actorUserId: integer('actor_user_id'),
  actorRole: text('actor_role'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id'),
  beforeState: text('before_state'),
  afterState: text('after_state'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  deviceInfo: text('device_info'),
  metadata: text('metadata'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  gymCreatedIdx: index('idx_audit_gym_created').on(t.gymId, t.createdAt),
  gymActionCreatedIdx: index('idx_audit_gym_action_created').on(t.gymId, t.action, t.createdAt),
  gymEntityIdx: index('idx_audit_gym_entity').on(t.gymId, t.entityType, t.entityId),
}));

// ============================================================
// 15. counters (atomic sequences: receipt numbers, member codes)
// ============================================================
export const counters = sqliteTable('counters', {
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  // 'member_code' (lifetime per gym) | 'receipt:<YYYY>' (per calendar year)
  counterType: text('counter_type').notNull(),
  value: integer('value').notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.gymId, t.counterType] }),
}));

// ============================================================
// 16. platform_settings (global key/value config: gateways, SMTP…)
// ============================================================
export const platformSettings = sqliteTable('platform_settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// ============================================================
// 17. communication_logs (per-message credit consumption + GDPR basis)
// ============================================================
export const communicationLogs = sqliteTable('communication_logs', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  /** Nullable: gym-wide broadcasts have no single member. */
  memberId: integer('member_id'),
  channel: text('channel', { enum: ['SMS', 'WHATSAPP', 'EMAIL'] }).notNull(),
  recipientPhone: text('recipient_phone'),
  recipientName: text('recipient_name'),
  messageType: text('message_type').notNull(),
  creditsDeducted: integer('credits_deducted').notNull().default(1),
  remainingBalance: integer('remaining_balance').notNull(),
  lawfulBasis: text('lawful_basis'),
  retentionUntil: integer('retention_until'),
  dispatchedById: integer('dispatched_by_id'),
  ip: text('ip'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  gymIdx: index('idx_comm_logs_gym').on(t.gymId, t.createdAt),
  memberIdx: index('idx_comm_logs_member').on(t.memberId),
  // Gym-scoped (a single-column FK allowed cross-tenant member references).
  memberFk: foreignKey({
    columns: [t.gymId, t.memberId],
    foreignColumns: [members.gymId, members.id],
  }),
}));

// ============================================================
// 18. menu_items (database catalog of system routes & pages)
// ============================================================
export const menuItems = sqliteTable('menu_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  href: text('href'),
  icon: text('icon'),
  groupKey: text('group_key').notNull().default('main'),
  order: integer('order').notNull().default(10),
  featureKey: text('feature_key'),
  adminOnly: integer('admin_only', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  groupOrderIdx: index('idx_menu_items_group_order').on(t.groupKey, t.order),
}));

// ============================================================
// 19. role_menus (junction table: gym role -> menu access)
// ============================================================
export const roleMenus = sqliteTable('role_menus', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  roleId: integer('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  menuItemId: integer('menu_item_id').notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  roleMenuUq: uniqueIndex('role_menus_role_menu_unique').on(t.gymId, t.roleId, t.menuItemId),
  gymRoleIdx: index('idx_role_menus_gym_role').on(t.gymId, t.roleId),
  gymMenuIdx: index('idx_role_menus_gym_menu').on(t.gymId, t.menuItemId),
}));

// ============================================================
// 20. classes (group fitness offerings)
// ============================================================
export const classes = sqliteTable('classes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  maxCapacity: integer('max_capacity').notNull().default(20),
  color: text('color').notNull().default('#4f46e5'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('classes_gym_id_unique').on(t.gymId, t.id),
  gymNameIdx: index('idx_classes_gym_name').on(t.gymId, t.name),
}));

// ============================================================
// 21. class_schedules (weekly timetables & one-off classes)
// ============================================================
export const classSchedules = sqliteTable('class_schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  trainerUserId: integer('trainer_user_id').references(() => users.id, { onDelete: 'set null' }),
  dayOfWeek: integer('day_of_week').notNull(), // 0-6
  startTime: text('start_time').notNull(), // HH:MM
  endTime: text('end_time').notNull(),     // HH:MM
  date: text('date'), // YYYY-MM-DD
  maxCapacity: integer('max_capacity').notNull().default(20),
  isCancelled: integer('is_cancelled', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('class_schedules_gym_id_unique').on(t.gymId, t.id),
  gymClassIdx: index('idx_class_schedules_gym_class').on(t.gymId, t.classId),
  gymDayIdx: index('idx_class_schedules_gym_day').on(t.gymId, t.dayOfWeek),
  gymTrainerIdx: index('idx_class_schedules_gym_trainer').on(t.gymId, t.trainerUserId),
}));

// ============================================================
// 22. class_bookings (member reservations)
// ============================================================
export const classBookings = sqliteTable('class_bookings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  scheduleId: integer('schedule_id').notNull().references(() => classSchedules.id, { onDelete: 'cascade' }),
  memberId: integer('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['BOOKED', 'ATTENDED', 'CANCELLED', 'NO_SHOW', 'WAITLIST'] }).notNull().default('BOOKED'),
  bookedAt: integer('booked_at').notNull(),
  attendedAt: integer('attended_at'),
}, (t) => ({
  gymIdUq: uniqueIndex('class_bookings_gym_id_unique').on(t.gymId, t.id),
  gymScheduleIdx: index('idx_class_bookings_gym_schedule').on(t.gymId, t.scheduleId),
  gymMemberIdx: index('idx_class_bookings_gym_member').on(t.gymId, t.memberId),
}));

// ============================================================
// 23. pt_packages (personal training agreements)
// ============================================================
export const ptPackages = sqliteTable('pt_packages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  memberId: integer('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  trainerUserId: integer('trainer_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** Display name shown in the member portal; defaults keep pre-0003 rows valid. */
  packageName: text('package_name').notNull().default('Personal Training'),
  totalSessions: integer('total_sessions').notNull(),
  completedSessions: integer('completed_sessions').notNull().default(0),
  pricePaise: integer('price_paise').notNull(),
  startDate: text('start_date').notNull(), // YYYY-MM-DD
  expiryDate: text('expiry_date').notNull(), // YYYY-MM-DD
  status: text('status', { enum: ['ACTIVE', 'COMPLETED', 'EXPIRED'] }).notNull().default('ACTIVE'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('pt_packages_gym_id_unique').on(t.gymId, t.id),
  gymMemberIdx: index('idx_pt_packages_gym_member').on(t.gymId, t.memberId),
  gymTrainerIdx: index('idx_pt_packages_gym_trainer').on(t.gymId, t.trainerUserId),
}));

// ============================================================
// 24. pt_sessions (individual workout logs)
// ============================================================
export const ptSessions = sqliteTable('pt_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  packageId: integer('package_id').notNull().references(() => ptPackages.id, { onDelete: 'cascade' }),
  sessionNumber: integer('session_number').notNull(),
  sessionDate: text('session_date').notNull(), // YYYY-MM-DD
  notes: text('notes'),
  trainerUserId: integer('trainer_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  signedOffByMember: integer('signed_off_by_member', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('pt_sessions_gym_id_unique').on(t.gymId, t.id),
  gymPackageIdx: index('idx_pt_sessions_gym_package').on(t.gymId, t.packageId),
}));

// ============================================================
// 25. products (POS retail & supplement catalog)
// ============================================================
export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sku: text('sku'),
  category: text('category').notNull().default('General'),
  pricePaise: integer('price_paise').notNull(),
  costPaise: integer('cost_paise').notNull().default(0),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
  taxRate: real('tax_rate').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('products_gym_id_unique').on(t.gymId, t.id),
  gymNameIdx: index('idx_products_gym_name').on(t.gymId, t.name),
}));

// ============================================================
// 26. pos_sales (POS transactions)
// ============================================================
export const posSales = sqliteTable('pos_sales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  receiptNumber: text('receipt_number').notNull(),
  memberId: integer('member_id').references(() => members.id, { onDelete: 'set null' }),
  subtotalPaise: integer('subtotal_paise').notNull(),
  taxPaise: integer('tax_paise').notNull().default(0),
  totalPaise: integer('total_paise').notNull(),
  paymentMode: text('payment_mode', { enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER'] }).notNull().default('CASH'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('pos_sales_gym_id_unique').on(t.gymId, t.id),
  gymReceiptUq: uniqueIndex('pos_sales_gym_receipt_unique').on(t.gymId, t.receiptNumber),
  gymMemberIdx: index('idx_pos_sales_gym_member').on(t.gymId, t.memberId),
}));

// ============================================================
// 27. pos_sale_items (items sold in POS transaction)
// ============================================================
export const posSaleItems = sqliteTable('pos_sale_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  saleId: integer('sale_id').notNull().references(() => posSales.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull(),
  unitPricePaise: integer('unit_price_paise').notNull(),
  totalPaise: integer('total_paise').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('pos_sale_items_gym_id_unique').on(t.gymId, t.id),
  gymSaleIdx: index('idx_pos_sale_items_gym_sale').on(t.gymId, t.saleId),
}));

// ============================================================
// 28. expense_categories (gym expense categories)
// ============================================================
export const expenseCategories = sqliteTable('expense_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('expense_categories_gym_id_unique').on(t.gymId, t.id),
  gymNameUq: uniqueIndex('expense_categories_gym_name_unique').on(t.gymId, t.name),
}));

// ============================================================
// 29. expenses (expenditure records)
// ============================================================
export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id').notNull().references(() => expenseCategories.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  amountPaise: integer('amount_paise').notNull(),
  expenseDate: text('expense_date').notNull(), // YYYY-MM-DD
  paymentMode: text('payment_mode', { enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER'] }).notNull().default('CASH'),
  vendor: text('vendor'),
  receiptUrl: text('receipt_url'),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('expenses_gym_id_unique').on(t.gymId, t.id),
  gymDateIdx: index('idx_expenses_gym_date').on(t.gymId, t.expenseDate),
  gymCategoryIdx: index('idx_expenses_gym_category').on(t.gymId, t.categoryId),
}));

// ============================================================
// 30. lockers (physical lockers)
// ============================================================
export const lockers = sqliteTable('lockers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  lockerNumber: text('locker_number').notNull(),
  zone: text('zone'),
  status: text('status', { enum: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'] }).notNull().default('AVAILABLE'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('lockers_gym_id_unique').on(t.gymId, t.id),
  gymLockerNumberUq: uniqueIndex('lockers_gym_number_unique').on(t.gymId, t.lockerNumber),
}));

// ============================================================
// 31. locker_allocations (locker rentals to members)
// ============================================================
export const lockerAllocations = sqliteTable('locker_allocations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  lockerId: integer('locker_id').notNull().references(() => lockers.id, { onDelete: 'cascade' }),
  memberId: integer('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  startDate: text('start_date').notNull(), // YYYY-MM-DD
  endDate: text('end_date').notNull(),   // YYYY-MM-DD
  depositPaise: integer('deposit_paise').notNull().default(0),
  rentPaise: integer('rent_paise').notNull().default(0),
  status: text('status', { enum: ['ACTIVE', 'TERMINATED', 'OVERDUE'] }).notNull().default('ACTIVE'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('locker_allocations_gym_id_unique').on(t.gymId, t.id),
  gymLockerIdx: index('idx_locker_allocations_gym_locker').on(t.gymId, t.lockerId),
  gymMemberIdx: index('idx_locker_allocations_gym_member').on(t.gymId, t.memberId),
}));

// Inferred row types
// ============================================================
export type PlatformAdmin = typeof platformAdmins.$inferSelect;
export type Gym = typeof gyms.$inferSelect;
export type License = typeof licenses.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type User = typeof users.$inferSelect;
export type GymMembershipPlan = typeof membershipPlans.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type PtCollection = typeof ptCollections.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;
export type UserPasswordReset = typeof userPasswordResets.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type Counter = typeof counters.$inferSelect;
export type PlatformSetting = typeof platformSettings.$inferSelect;
export type CommunicationLog = typeof communicationLogs.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type RoleMenu = typeof roleMenus.$inferSelect;
export type ClassItemRow = typeof classes.$inferSelect;
export type ClassScheduleRow = typeof classSchedules.$inferSelect;
export type ClassBookingRow = typeof classBookings.$inferSelect;
export type PtPackageRow = typeof ptPackages.$inferSelect;
export type PtSessionRow = typeof ptSessions.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type PosSaleRow = typeof posSales.$inferSelect;
export type PosSaleItemRow = typeof posSaleItems.$inferSelect;
export type ExpenseCategoryRow = typeof expenseCategories.$inferSelect;
export type ExpenseRow = typeof expenses.$inferSelect;
export type LockerRow = typeof lockers.$inferSelect;
export type LockerAllocationRow = typeof lockerAllocations.$inferSelect;

