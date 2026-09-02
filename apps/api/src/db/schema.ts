// filepath: apps/api/src/db/schema.ts
/**
 * Drizzle schema — TypeScript mirror of `apps/api/migrations/*.sql`.
 *
 * Source of truth: the 4 SQL migrations. This file is read-only with
 * respect to D1; we never write generated SQL from it. Run
 *   `pnpm db:schema:pull:local`
 * to diff against the D1 local DB and confirm parity.
 *
 * Conventions:
 *   - All money columns end in `_paise` (integer paise).
 *   - All timestamps are unix seconds (INTEGER).
 *   - `attendance_date` is YYYYMMDD INTEGER.
 *   - Composite FKs (gym_id, id) mirror the DB-level tenant invariants.
 */
import { sqliteTable, integer, text, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

// ============================================================
// 1. platform_admins
// ============================================================
export const platformAdmins = sqliteTable('platform_admins', {
  id: integer('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  status: text('status', { enum: ['ACTIVE', 'DISABLED'] }).notNull().default('ACTIVE'),
  lastLoginAt: integer('last_login_at'),
  passwordAlgo: text('password_algo', { enum: ['sha256', 'argon2id'] }).notNull().default('sha256'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

// ============================================================
// 2. gyms
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
});

// ============================================================
// 3. licenses
// ============================================================
export const licenses = sqliteTable('licenses', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull().unique(),
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
  features: text('features').notNull().default('{}'),
  startedAt: integer('started_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  status: text('status', { enum: ['ACTIVE', 'EXPIRED', 'SUSPENDED'] }).notNull().default('ACTIVE'),
  createdByAdminId: integer('created_by_admin_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// ============================================================
// 4. users
// ============================================================
export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['OWNER', 'MANAGER', 'STAFF', 'TRAINER', 'MEMBER'] }).notNull(),
  status: text('status', { enum: ['ACTIVE', 'DISABLED'] }).notNull().default('ACTIVE'),
  permissions: text('permissions').notNull().default('{}'),
  lastLoginAt: integer('last_login_at'),
  passwordAlgo: text('password_algo', { enum: ['sha256', 'argon2id'] }).notNull().default('sha256'),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: integer('locked_until'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => ({
  gymEmailUq: uniqueIndex('users_gym_email_unique').on(t.gymId, t.email),
  gymRoleIdx: index('idx_users_gym_role').on(t.gymId, t.role),
  gymStatusIdx: index('idx_users_gym_status').on(t.gymId, t.status, t.deletedAt),
}));

// ============================================================
// 5. gym_settings
// ============================================================
export const gymSettings = sqliteTable('gym_settings', {
  gymId: integer('gym_id').primaryKey(),
  settings: text('settings').notNull().default('{}'),
  updatedByUserId: integer('updated_by_user_id'),
  updatedAt: integer('updated_at').notNull(),
});

// ============================================================
// 6. membership_plans
// ============================================================
export const membershipPlans = sqliteTable('membership_plans', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  durationMonths: integer('duration_months').notNull(),
  pricePaise: integer('price_paise').notNull(),
  admissionFeePaise: integer('admission_fee_paise').notNull().default(0),
  taxPercentage: real('tax_percentage').notNull().default(0),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => ({
  gymNameUq: uniqueIndex('membership_plans_gym_name_unique').on(t.gymId, t.name),
  gymActiveIdx: index('idx_membership_plans_gym_active').on(t.gymId, t.isActive, t.deletedAt),
}));

// ============================================================
// 7. members
// ============================================================
export const members = sqliteTable('members', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull(),
  memberCode: text('member_code').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name'),
  email: text('email'),
  phone: text('phone').notNull(),
  gender: text('gender', { enum: ['MALE', 'FEMALE', 'OTHER'] }),
  dateOfBirth: integer('date_of_birth'),
  photoUrl: text('photo_url'),
  faceEmbedding: text('face_embedding'),
  address: text('address'),
  city: text('city'),
  pincode: text('pincode'),
  emergencyContactName: text('emergency_contact_name'),
  emergencyContactPhone: text('emergency_contact_phone'),
  healthNotes: text('health_notes'),
  status: text('status', { enum: ['ACTIVE', 'INACTIVE', 'BLOCKED', 'EXPIRED', 'FROZEN'] }).notNull().default('ACTIVE'),
  joinedDate: integer('joined_date').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (t) => ({
  gymCodeUq: uniqueIndex('members_gym_member_code_unique').on(t.gymId, t.memberCode),
  gymPhoneUq: uniqueIndex('members_gym_phone_unique').on(t.gymId, t.phone),
  gymStatusIdx: index('idx_members_gym_status').on(t.gymId, t.status, t.deletedAt),
  gymNameIdx: index('idx_members_gym_name').on(t.gymId, t.lastName, t.firstName),
}));

// ============================================================
// 8. memberships
// ============================================================
export const memberships = sqliteTable('memberships', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull(),
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
  gymIdIdx: uniqueIndex('memberships_gym_id').on(t.gymId, t.id),
  gymMemberIdx: index('idx_memberships_gym_member').on(t.gymId, t.memberId),
  gymStatusDatesIdx: index('idx_memberships_gym_status_dates').on(t.gymId, t.status, t.endDate),
  gymEndDateIdx: index('idx_memberships_gym_end_date').on(t.gymId, t.endDate),
}));

// ============================================================
// 9. payments
// ============================================================
export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull(),
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
// 10. pt_collections
// ============================================================
export const ptCollections = sqliteTable('pt_collections', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull(),
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
}));

// ============================================================
// 11. attendance
// ============================================================
export const attendance = sqliteTable('attendance', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull(),
  memberId: integer('member_id').notNull(),
  checkInTime: integer('check_in_time').notNull(),
  checkOutTime: integer('check_out_time'),
  attendanceDate: integer('attendance_date').notNull(),
  method: text('method', { enum: ['MANUAL', 'QR', 'FACE_ID'] }).notNull(),
  recordedByUserId: integer('recorded_by_user_id'),
  deviceInfo: text('device_info'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  gymDateIdx: index('idx_attendance_gym_date').on(t.gymId, t.attendanceDate),
  gymMemberDateIdx: index('idx_attendance_gym_member_date').on(t.gymId, t.memberId, t.attendanceDate),
  gymCheckinIdx: index('idx_attendance_gym_checkin').on(t.gymId, t.checkInTime),
}));

// ============================================================
// 12. user_sessions
// ============================================================
export const userSessions = sqliteTable('user_sessions', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull(),
  userId: integer('user_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  issuedAt: integer('issued_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  revokedAt: integer('revoked_at'),
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
// 14. audit_events (gym-scoped)
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
// 15. saas_audit_events
// ============================================================
export const saasAuditEvents = sqliteTable('saas_audit_events', {
  id: integer('id').primaryKey(),
  actorAdminId: integer('actor_admin_id').notNull(),
  affectedGymId: integer('affected_gym_id'),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: integer('entity_id'),
  beforeState: text('before_state'),
  afterState: text('after_state'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  metadata: text('metadata'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  adminCreatedIdx: index('idx_saas_audit_admin_created').on(t.actorAdminId, t.createdAt),
  gymCreatedIdx: index('idx_saas_audit_gym_created').on(t.affectedGymId, t.createdAt),
}));

// ============================================================
// 16. platform_settings
// ============================================================
export const platformSettings = sqliteTable('platform_settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// ============================================================
// 17. gym_features
// ============================================================
export const gymFeatures = sqliteTable('gym_features', {
  gymId: integer('gym_id').notNull(),
  featureKey: text('feature_key').notNull(),
  isEnabled: integer('is_enabled').notNull().default(1),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  pk: uniqueIndex('gym_features_pk').on(t.gymId, t.featureKey),
  lookupIdx: index('idx_gym_features_lookup').on(t.gymId, t.isEnabled),
}));

// ============================================================
// 18. communication_logs
// ============================================================
export const communicationLogs = sqliteTable('communication_logs', {
  id: integer('id').primaryKey(),
  gymId: integer('gym_id').notNull(),
  channel: text('channel', { enum: ['SMS', 'WHATSAPP', 'EMAIL'] }).notNull(),
  recipientPhone: text('recipient_phone'),
  recipientName: text('recipient_name'),
  messageType: text('message_type').notNull(),
  creditsDeducted: integer('credits_deducted').notNull().default(1),
  remainingBalance: integer('remaining_balance').notNull(),
  dispatchedById: integer('dispatched_by_id'),
  ip: text('ip'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  gymIdx: index('idx_comm_logs_gym').on(t.gymId, t.createdAt),
}));

// ============================================================
// Inferred row types (use throughout the codebase for type safety)
// ============================================================
export type Gym = typeof gyms.$inferSelect;
export type License = typeof licenses.$inferSelect;
export type User = typeof users.$inferSelect;
export type GymMembershipPlan = typeof membershipPlans.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type PtCollection = typeof ptCollections.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type SaasAuditEvent = typeof saasAuditEvents.$inferSelect;
export type GymFeature = typeof gymFeatures.$inferSelect;
export type CommunicationLog = typeof communicationLogs.$inferSelect;
export type PlatformSettings = typeof platformSettings.$inferSelect;
export type PlatformAdmin = typeof platformAdmins.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;
export type UserPasswordReset = typeof userPasswordResets.$inferSelect;