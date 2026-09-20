// filepath: apps/api/src/db/schema.ts
/**
 * Drizzle schema — TypeScript mirror of the canonical SQL baseline in `apps/api/migrations/0000_init.sql`.
 *
 * 100% camelCase everywhere: database table names, column names, foreign keys, and indexes
 * match TypeScript models 1:1.
 *
 * Conventions (kept invariant across the whole schema):
 *   - All table names and column names are strictly camelCase.
 *   - All money columns end in `Paise` (INTEGER paise; ₹1 = 100 paise).
 *   - All timestamps are unix seconds (INTEGER).
 *   - `attendanceDate` is YYYYMMDD INTEGER (fast range scans).
 *   - Every tenant-owned table carries `gymId`, and composite
 *     `(gymId, id)` foreign keys mirror the DB-level tenant invariants.
 *   - Any parent referenced by a composite FK MUST expose a UNIQUE index on
 *     the referenced columns, otherwise SQLite raises "foreign key mismatch".
 */
import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text, real, uniqueIndex, index, primaryKey, foreignKey } from 'drizzle-orm/sqlite-core';

// ============================================================
// 1. platformAdmins (platform-level operators, not tenant users)
// ============================================================
export const platformAdmins = sqliteTable('platformAdmins', {
  id: integer('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  name: text('name').notNull(),
  status: text('status', { enum: ['ACTIVE', 'DISABLED'] }).notNull().default('ACTIVE'),
  failedLoginCount: integer('failedLoginCount').notNull().default(0),
  lockedUntil: integer('lockedUntil'),
  lastLoginAt: integer('lastLoginAt'),
  authorizedGyms: text('authorizedGyms'),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
  deletedAt: integer('deletedAt'),
});

// ============================================================
// 2. platformSettings (global config)
// ============================================================
export const platformSettings = sqliteTable('platformSettings', {
  key: text('key').primaryKey(),
  valueJson: text('valueJson').notNull(),
  updatedAt: integer('updatedAt').notNull(),
});

// ============================================================
// 3. gyms (tenants)
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
  gstNumber: text('gstNumber'),
  currency: text('currency').notNull().default('INR'),
  logoUrl: text('logoUrl'),
  status: text('status', { enum: ['ACTIVE', 'SUSPENDED', 'CANCELLED'] }).notNull().default('ACTIVE'),
  notificationSettingsJson: text('notificationSettingsJson'),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
  deletedAt: integer('deletedAt'),
}, (t) => ({
  statusIdx: index('idxGymsStatus').on(t.status, t.deletedAt),
}));

// ============================================================
// 4. licenses (one commercial license per gym — quotas + feature flags)
// ============================================================
export const licenses = sqliteTable('licenses', {
  id: integer('id').primaryKey(),
  gymId: integer('gymId').notNull().unique().references(() => gyms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: text('code').notNull(),
  pricePaise: integer('pricePaise').notNull(),
  billingPeriod: text('billingPeriod', { enum: ['MONTHLY', 'YEARLY'] }).notNull().default('MONTHLY'),
  maxMembers: integer('maxMembers').notNull(),
  maxOwners: integer('maxOwners').notNull().default(1),
  maxManagers: integer('maxManagers').notNull(),
  maxStaffTotal: integer('maxStaffTotal').notNull(),
  maxSms: integer('maxSms').notNull(),
  maxWhatsapp: integer('maxWhatsapp').notNull(),
  maxEmail: integer('maxEmail').notNull(),
  smsUsed: integer('smsUsed').notNull().default(0),
  whatsappUsed: integer('whatsappUsed').notNull().default(0),
  emailUsed: integer('emailUsed').notNull().default(0),
  features: text('features').notNull().default('{}'),
  startedAt: integer('startedAt').notNull(),
  expiresAt: integer('expiresAt').notNull(),
  status: text('status', { enum: ['ACTIVE', 'EXPIRED', 'SUSPENDED'] }).notNull().default('ACTIVE'),
  renewalReminderSentAt: integer('renewalReminderSentAt'),
  trialEndsAt: integer('trialEndsAt'),
  createdByAdminId: integer('createdByAdminId'),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
}, (t) => ({
  codeUq: uniqueIndex('licensesCodeUnique').on(t.code),
}));

// ============================================================
// 5. roles (tenant-defined RBAC roles)
// ============================================================
export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey(),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  permissions: text('permissions').notNull().default('[]'),
  isOwner: integer('isOwner', { mode: 'boolean' }).notNull().default(false),
  isDefault: integer('isDefault', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
  deletedAt: integer('deletedAt'),
}, (t) => ({
  gymNameUq: uniqueIndex('rolesGymNameUnique')
    .on(t.gymId, t.name)
    .where(sql`deletedAt IS NULL`),
  gymIdx: index('idxRolesGym').on(t.gymId, t.deletedAt),
}));

// ============================================================
// 6. users (tenant staff & owners)
// ============================================================
export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  passwordHash: text('passwordHash').notNull(),
  roleId: integer('roleId').references(() => roles.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['ACTIVE', 'DISABLED'] }).notNull().default('ACTIVE'),
  isOwner: integer('isOwner', { mode: 'boolean' }).notNull().default(false),
  lastLoginAt: integer('lastLoginAt'),
  failedLoginCount: integer('failedLoginCount').notNull().default(0),
  lockedUntil: integer('lockedUntil'),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
  deletedAt: integer('deletedAt'),
}, (t) => ({
  gymIdUq: uniqueIndex('usersGymIdUnique').on(t.gymId, t.id),
  gymEmailUq: uniqueIndex('usersGymEmailUnique').on(t.gymId, t.email),
  ownerIdx: index('idxUsersGymOwner').on(t.gymId, t.isOwner),
  statusIdx: index('idxUsersGymStatus').on(t.gymId, t.status, t.deletedAt),
  roleIdx: index('idxUsersGymRole').on(t.gymId, t.roleId),
}));

// ============================================================
// 7. userSessions (session registry)
// ============================================================
export const userSessions = sqliteTable('userSessions', {
  id: integer('id').primaryKey(),
  gymId: integer('gymId').notNull().default(0),
  userId: integer('userId').notNull(),
  tokenHash: text('tokenHash').notNull().unique(),
  refreshTokenHash: text('refreshTokenHash'),
  refreshTokenExpiresAt: integer('refreshTokenExpiresAt'),
  ip: text('ip'),
  userAgent: text('userAgent'),
  issuedAt: integer('issuedAt').notNull(),
  expiresAt: integer('expiresAt').notNull(),
  revokedAt: integer('revokedAt'),
  userType: text('userType', { enum: ['GYM_USER', 'PLATFORM_ADMIN'] }).notNull().default('GYM_USER'),
}, (t) => ({
  gymUserIdx: index('idxUserSessionsGymUser').on(t.gymId, t.userId),
  expiresIdx: index('idxUserSessionsExpires').on(t.expiresAt),
}));

// ============================================================
// 8. userPasswordResets
// ============================================================
export const userPasswordResets = sqliteTable('userPasswordResets', {
  id: integer('id').primaryKey(),
  gymId: integer('gymId').notNull(),
  userId: integer('userId').notNull(),
  tokenHash: text('tokenHash').notNull().unique(),
  expiresAt: integer('expiresAt').notNull(),
  usedAt: integer('usedAt'),
  createdAt: integer('createdAt').notNull(),
}, (t) => ({
  userFk: foreignKey({
    columns: [t.gymId, t.userId],
    foreignColumns: [users.gymId, users.id],
  }).onDelete('cascade'),
}));

// ============================================================
// 9. auditEvents (append-only tenant activity log)
// ============================================================
export const auditEvents = sqliteTable('auditEvents', {
  id: integer('id').primaryKey(),
  gymId: integer('gymId').notNull(),
  actorUserId: integer('actorUserId'),
  actorRole: text('actorRole'),
  action: text('action').notNull(),
  entityType: text('entityType').notNull(),
  entityId: integer('entityId'),
  beforeState: text('beforeState'),
  afterState: text('afterState'),
  ip: text('ip'),
  userAgent: text('userAgent'),
  deviceInfo: text('deviceInfo'),
  metadata: text('metadata'),
  createdAt: integer('createdAt').notNull(),
}, (t) => ({
  createdIdx: index('idxAuditGymCreated').on(t.gymId, t.createdAt),
  actionIdx: index('idxAuditGymActionCreated').on(t.gymId, t.action, t.createdAt),
  entityIdx: index('idxAuditGymEntity').on(t.gymId, t.entityType, t.entityId),
}));

// ============================================================
// 10. counters (atomic sequence generators)
// ============================================================
export const counters = sqliteTable('counters', {
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  counterType: text('counterType').notNull(),
  value: integer('value').notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.gymId, t.counterType] }),
}));

// ============================================================
// 11. membershipPlans (catalog)
// ============================================================
export const membershipPlans = sqliteTable('membershipPlans', {
  id: integer('id').primaryKey(),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  durationMonths: integer('durationMonths').notNull(),
  pricePaise: integer('pricePaise').notNull(),
  admissionFeePaise: integer('admissionFeePaise').notNull().default(0),
  taxPercentage: real('taxPercentage').notNull().default(0),
  isActive: integer('isActive').notNull().default(1),
  billingPeriod: text('billingPeriod', { enum: ['MONTHLY', 'YEARLY'] }).notNull().default('MONTHLY'),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
  deletedAt: integer('deletedAt'),
}, (t) => ({
  gymIdUq: uniqueIndex('membershipPlansGymIdUnique').on(t.gymId, t.id),
  gymNameUq: uniqueIndex('membershipPlansGymNameUnique').on(t.gymId, t.name),
  activeIdx: index('idxMembershipPlansGymActive').on(t.gymId, t.isActive, t.deletedAt),
}));

// ============================================================
// 12. members (the gym's customers)
// ============================================================
export const members = sqliteTable('members', {
  id: integer('id').primaryKey(),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  memberCode: text('memberCode').notNull(),
  firstName: text('firstName').notNull(),
  lastName: text('lastName'),
  email: text('email'),
  phone: text('phone').notNull(),
  gender: text('gender', { enum: ['MALE', 'FEMALE', 'OTHER'] }),
  dateOfBirth: integer('dateOfBirth'),
  photoUrl: text('photoUrl'),
  faceEmbedding: text('faceEmbedding'),
  biometricConsentGiven: integer('biometricConsentGiven').notNull().default(0),
  biometricConsentAt: integer('biometricConsentAt'),
  biometricConsentVersion: text('biometricConsentVersion').default('1.0'),
  address: text('address'),
  city: text('city'),
  pincode: text('pincode'),
  emergencyContactName: text('emergencyContactName'),
  emergencyContactPhone: text('emergencyContactPhone'),
  healthNotes: text('healthNotes'),
  status: text('status', {
    enum: ['ACTIVE', 'INACTIVE', 'BLOCKED', 'EXPIRED', 'FROZEN', 'CANCELLED'],
  }).notNull().default('ACTIVE'),
  joinedDate: integer('joinedDate').notNull(),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
  deletedAt: integer('deletedAt'),
}, (t) => ({
  gymIdUq: uniqueIndex('membersGymIdUnique').on(t.gymId, t.id),
  gymMemberCodeUq: uniqueIndex('membersGymMemberCodeUnique').on(t.gymId, t.memberCode),
  gymPhoneUq: uniqueIndex('membersGymPhoneUnique').on(t.gymId, t.phone),
  statusIdx: index('idxMembersGymStatus').on(t.gymId, t.status, t.deletedAt),
  nameIdx: index('idxMembersGymName').on(t.gymId, t.lastName, t.firstName),
}));

// ============================================================
// 13. memberships (member subscription contracts)
// ============================================================
export const memberships = sqliteTable('memberships', {
  id: integer('id').primaryKey(),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  memberId: integer('memberId').notNull(),
  membershipPlanId: integer('membershipPlanId').notNull(),
  startDate: integer('startDate').notNull(),
  endDate: integer('endDate').notNull(),
  totalAmountPaise: integer('totalAmountPaise').notNull(),
  discountPaise: integer('discountPaise').notNull().default(0),
  finalAmountPaise: integer('finalAmountPaise').notNull(),
  paidAmountPaise: integer('paidAmountPaise').notNull().default(0),
  dueAmountPaise: integer('dueAmountPaise').notNull().default(0),
  status: text('status', { enum: ['ACTIVE', 'EXPIRED', 'FROZEN', 'CANCELLED'] }).notNull().default('ACTIVE'),
  frozenAt: integer('frozenAt'),
  notes: text('notes'),
  createdByUserId: integer('createdByUserId'),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
  deletedAt: integer('deletedAt'),
}, (t) => ({
  gymIdUq: uniqueIndex('membershipsGymIdUnique').on(t.gymId, t.id),
  memberFk: foreignKey({
    columns: [t.gymId, t.memberId],
    foreignColumns: [members.gymId, members.id],
  }).onDelete('cascade'),
  planFk: foreignKey({
    columns: [t.gymId, t.membershipPlanId],
    foreignColumns: [membershipPlans.gymId, membershipPlans.id],
  }).onDelete('restrict'),
  memberIdx: index('idxMembershipsGymMember').on(t.gymId, t.memberId),
  statusDatesIdx: index('idxMembershipsGymStatusDates').on(t.gymId, t.status, t.endDate),
  endDateIdx: index('idxMembershipsGymEndDate').on(t.gymId, t.endDate),
}));

// ============================================================
// 14. payments (financial ledger)
// ============================================================
export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey(),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  memberId: integer('memberId').notNull(),
  membershipId: integer('membershipId'),
  paymentType: text('paymentType', { enum: ['GYM', 'PERSONAL_TRAINING'] }).notNull().default('GYM'),
  receiptNumber: text('receiptNumber').notNull(),
  amountPaise: integer('amountPaise').notNull(),
  paymentDate: integer('paymentDate').notNull(),
  paymentMode: text('paymentMode', {
    enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER'],
  }).notNull(),
  referenceId: text('referenceId'),
  status: text('status', { enum: ['COMPLETED', 'REFUNDED', 'VOID'] }).notNull().default('COMPLETED'),
  recordedByUserId: integer('recordedByUserId'),
  notes: text('notes'),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
  deletedAt: integer('deletedAt'),
}, (t) => ({
  gymIdUq: uniqueIndex('paymentsGymIdUnique').on(t.gymId, t.id),
  receiptUq: uniqueIndex('paymentsGymReceiptUnique').on(t.gymId, t.receiptNumber),
  memberFk: foreignKey({
    columns: [t.gymId, t.memberId],
    foreignColumns: [members.gymId, members.id],
  }).onDelete('restrict'),
  membershipFk: foreignKey({
    columns: [t.gymId, t.membershipId],
    foreignColumns: [memberships.gymId, memberships.id],
  }).onDelete('set null'),
  dateIdx: index('idxPaymentsGymDate').on(t.gymId, t.paymentDate),
  memberDateIdx: index('idxPaymentsGymMemberDate').on(t.gymId, t.memberId, t.paymentDate),
  statusDateIdx: index('idxPaymentsGymStatusDate').on(t.gymId, t.status, t.paymentDate),
}));

// ============================================================
// 15. ptCollections (PT fees + trainer commission)
// ============================================================
export const ptCollections = sqliteTable('ptCollections', {
  id: integer('id').primaryKey(),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  memberId: integer('memberId').notNull(),
  trainerId: integer('trainerId').notNull(),
  sessions: integer('sessions').notNull().default(0),
  amountPaise: integer('amountPaise').notNull(),
  commissionPercentage: real('commissionPercentage').notNull().default(0),
  commissionPaise: integer('commissionPaise').notNull().default(0),
  commissionStatus: text('commissionStatus', { enum: ['PENDING', 'PAID'] }).notNull().default('PENDING'),
  paymentMode: text('paymentMode', {
    enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER'],
  }).notNull().default('CASH'),
  paymentDate: integer('paymentDate').notNull(),
  receiptNumber: text('receiptNumber'),
  notes: text('notes'),
  recordedByUserId: integer('recordedByUserId'),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
  deletedAt: integer('deletedAt'),
}, (t) => ({
  gymIdUq: uniqueIndex('ptCollectionsGymIdUnique').on(t.gymId, t.id),
  memberFk: foreignKey({
    columns: [t.gymId, t.memberId],
    foreignColumns: [members.gymId, members.id],
  }).onDelete('restrict'),
  trainerFk: foreignKey({
    columns: [t.gymId, t.trainerId],
    foreignColumns: [users.gymId, users.id],
  }).onDelete('restrict'),
  dateIdx: index('idxPtCollectionsGymDate').on(t.gymId, t.paymentDate),
  trainerIdx: index('idxPtCollectionsGymTrainer').on(t.gymId, t.trainerId, t.commissionStatus),
  receiptUq: uniqueIndex('ptCollectionsGymReceiptUnique')
    .on(t.gymId, t.receiptNumber)
    .where(sql`receiptNumber IS NOT NULL`),
}));

// ============================================================
// 16. attendance (floor check-ins)
// ============================================================
export const attendance = sqliteTable('attendance', {
  id: integer('id').primaryKey(),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  memberId: integer('memberId').notNull(),
  checkInTime: integer('checkInTime').notNull(),
  checkOutTime: integer('checkOutTime'),
  attendanceDate: integer('attendanceDate').notNull(),
  method: text('method', { enum: ['MANUAL', 'QR', 'FACE_ID', 'KIOSK'] }).notNull(),
  recordedByUserId: integer('recordedByUserId'),
  deviceInfo: text('deviceInfo'),
  createdAt: integer('createdAt').notNull(),
  deletedAt: integer('deletedAt'),
}, (t) => ({
  gymIdUq: uniqueIndex('attendanceGymIdUnique').on(t.gymId, t.id),
  // One check-in per member per day — enforced at the DB level so two
  // concurrent desk/kiosk taps cannot create duplicate rows (the
  // read-then-write above races). checkIn() relies on this constraint.
  memberDayUq: uniqueIndex('attendanceGymMemberDayUnique').on(t.gymId, t.memberId, t.attendanceDate),
  memberFk: foreignKey({
    columns: [t.gymId, t.memberId],
    foreignColumns: [members.gymId, members.id],
  }).onDelete('cascade'),
  dateIdx: index('idxAttendanceGymDate').on(t.gymId, t.attendanceDate),
  memberDateIdx: index('idxAttendanceGymMemberDate').on(t.gymId, t.memberId, t.attendanceDate),
  checkinIdx: index('idxAttendanceGymCheckin').on(t.gymId, t.checkInTime),
}));

// ============================================================
// 17. communicationLogs
// ============================================================
export const communicationLogs = sqliteTable('communicationLogs', {
  id: integer('id').primaryKey(),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  memberId: integer('memberId').references(() => members.id),
  channel: text('channel', { enum: ['SMS', 'WHATSAPP', 'EMAIL'] }).notNull(),
  recipientPhone: text('recipientPhone'),
  recipientName: text('recipientName'),
  messageType: text('messageType').notNull(),
  creditsDeducted: integer('creditsDeducted').notNull().default(1),
  remainingBalance: integer('remainingBalance').notNull(),
  lawfulBasis: text('lawfulBasis'),
  retentionUntil: integer('retentionUntil'),
  dispatchedById: integer('dispatchedById'),
  ip: text('ip'),
  createdAt: integer('createdAt').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('communicationLogsGymIdUnique').on(t.gymId, t.id),
  gymIdx: index('idxCommLogsGym').on(t.gymId, t.createdAt),
  memberIdx: index('idxCommLogsMember').on(t.memberId),
}));

// ============================================================
// 18. menuItems (global catalog)
// ============================================================
export const menuItems = sqliteTable('menuItems', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  href: text('href'),
  icon: text('icon'),
  groupKey: text('groupKey').notNull().default('main'),
  order: integer('order').notNull().default(10),
  featureKey: text('featureKey'),
  adminOnly: integer('adminOnly', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
}, (t) => ({
  groupOrderIdx: index('idxMenuItemsGroupOrder').on(t.groupKey, t.order),
}));

// ============================================================
// 19. roleMenus (junction table)
// ============================================================
export const roleMenus = sqliteTable('roleMenus', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  roleId: integer('roleId').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  menuItemId: integer('menuItemId').notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
  createdAt: integer('createdAt').notNull(),
}, (t) => ({
  roleMenuUq: uniqueIndex('roleMenusRoleMenuUnique').on(t.gymId, t.roleId, t.menuItemId),
  gymRoleIdx: index('idxRoleMenusGymRole').on(t.gymId, t.roleId),
  gymMenuIdx: index('idxRoleMenusGymMenu').on(t.gymId, t.menuItemId),
}));

// ============================================================
// 20. classes
// ============================================================
export const classes = sqliteTable('classes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  durationMinutes: integer('durationMinutes').notNull().default(60),
  maxCapacity: integer('maxCapacity').notNull().default(20),
  color: text('color').notNull().default('#4f46e5'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('classesGymIdUnique').on(t.gymId, t.id),
  nameIdx: index('idxClassesGymName').on(t.gymId, t.name),
}));

// ============================================================
// 21. classSchedules
// ============================================================
export const classSchedules = sqliteTable('classSchedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  classId: integer('classId').notNull(),
  trainerUserId: integer('trainerUserId'),
  dayOfWeek: integer('dayOfWeek').notNull(),
  startTime: text('startTime').notNull(),
  endTime: text('endTime').notNull(),
  date: text('date'),
  maxCapacity: integer('maxCapacity').notNull().default(20),
  isCancelled: integer('isCancelled', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('createdAt').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('classSchedulesGymIdUnique').on(t.gymId, t.id),
  classFk: foreignKey({
    columns: [t.gymId, t.classId],
    foreignColumns: [classes.gymId, classes.id],
  }).onDelete('cascade'),
  trainerFk: foreignKey({
    columns: [t.gymId, t.trainerUserId],
    foreignColumns: [users.gymId, users.id],
  }).onDelete('set null'),
  classIdx: index('idxClassSchedulesGymClass').on(t.gymId, t.classId),
  dayIdx: index('idxClassSchedulesGymDay').on(t.gymId, t.dayOfWeek),
  trainerIdx: index('idxClassSchedulesGymTrainer').on(t.gymId, t.trainerUserId),
}));

// ============================================================
// 22. classBookings
// ============================================================
export const classBookings = sqliteTable('classBookings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  scheduleId: integer('scheduleId').notNull(),
  memberId: integer('memberId').notNull(),
  status: text('status', { enum: ['BOOKED', 'ATTENDED', 'CANCELLED', 'NO_SHOW', 'WAITLIST'] }).notNull().default('BOOKED'),
  bookedAt: integer('bookedAt').notNull(),
  attendedAt: integer('attendedAt'),
}, (t) => ({
  gymIdUq: uniqueIndex('classBookingsGymIdUnique').on(t.gymId, t.id),
  scheduleFk: foreignKey({
    columns: [t.gymId, t.scheduleId],
    foreignColumns: [classSchedules.gymId, classSchedules.id],
  }).onDelete('cascade'),
  memberFk: foreignKey({
    columns: [t.gymId, t.memberId],
    foreignColumns: [members.gymId, members.id],
  }).onDelete('cascade'),
  scheduleIdx: index('idxClassBookingsGymSchedule').on(t.gymId, t.scheduleId),
  memberIdx: index('idxClassBookingsGymMember').on(t.gymId, t.memberId),
}));

// ============================================================
// 23. ptPackages
// ============================================================
export const ptPackages = sqliteTable('ptPackages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  memberId: integer('memberId').notNull(),
  trainerUserId: integer('trainerUserId').notNull(),
  packageName: text('packageName').notNull().default('Personal Training'),
  totalSessions: integer('totalSessions').notNull(),
  completedSessions: integer('completedSessions').notNull().default(0),
  pricePaise: integer('pricePaise').notNull(),
  startDate: text('startDate').notNull(),
  expiryDate: text('expiryDate').notNull(),
  status: text('status', { enum: ['ACTIVE', 'COMPLETED', 'EXPIRED'] }).notNull().default('ACTIVE'),
  notes: text('notes'),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('ptPackagesGymIdUnique').on(t.gymId, t.id),
  memberFk: foreignKey({
    columns: [t.gymId, t.memberId],
    foreignColumns: [members.gymId, members.id],
  }).onDelete('cascade'),
  trainerFk: foreignKey({
    columns: [t.gymId, t.trainerUserId],
    foreignColumns: [users.gymId, users.id],
  }).onDelete('cascade'),
  memberIdx: index('idxPtPackagesGymMember').on(t.gymId, t.memberId),
  trainerIdx: index('idxPtPackagesGymTrainer').on(t.gymId, t.trainerUserId),
}));

// ============================================================
// 24. ptSessions
// ============================================================
export const ptSessions = sqliteTable('ptSessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  packageId: integer('packageId').notNull(),
  sessionNumber: integer('sessionNumber').notNull(),
  sessionDate: text('sessionDate').notNull(),
  notes: text('notes'),
  trainerUserId: integer('trainerUserId').notNull(),
  signedOffByMember: integer('signedOffByMember', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('createdAt').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('ptSessionsGymIdUnique').on(t.gymId, t.id),
  packageFk: foreignKey({
    columns: [t.gymId, t.packageId],
    foreignColumns: [ptPackages.gymId, ptPackages.id],
  }).onDelete('cascade'),
  trainerFk: foreignKey({
    columns: [t.gymId, t.trainerUserId],
    foreignColumns: [users.gymId, users.id],
  }).onDelete('cascade'),
  packageIdx: index('idxPtSessionsGymPackage').on(t.gymId, t.packageId),
}));

// ============================================================
// 25. products (POS retail)
// ============================================================
export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sku: text('sku'),
  category: text('category').notNull().default('General'),
  pricePaise: integer('pricePaise').notNull(),
  costPaise: integer('costPaise').notNull().default(0),
  stockQuantity: integer('stockQuantity').notNull().default(0),
  lowStockThreshold: integer('lowStockThreshold').notNull().default(5),
  taxRate: real('taxRate').notNull().default(0),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('productsGymIdUnique').on(t.gymId, t.id),
  nameIdx: index('idxProductsGymName').on(t.gymId, t.name),
}));

// ============================================================
// 26. posSales
// ============================================================
export const posSales = sqliteTable('posSales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  receiptNumber: text('receiptNumber').notNull(),
  memberId: integer('memberId'),
  subtotalPaise: integer('subtotalPaise').notNull(),
  taxPaise: integer('taxPaise').notNull().default(0),
  totalPaise: integer('totalPaise').notNull(),
  paymentMode: text('paymentMode', {
    enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER'],
  }).notNull().default('CASH'),
  notes: text('notes'),
  createdAt: integer('createdAt').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('posSalesGymIdUnique').on(t.gymId, t.id),
  receiptUq: uniqueIndex('posSalesGymReceiptUnique').on(t.gymId, t.receiptNumber),
  memberFk: foreignKey({
    columns: [t.gymId, t.memberId],
    foreignColumns: [members.gymId, members.id],
  }).onDelete('set null'),
  memberIdx: index('idxPosSalesGymMember').on(t.gymId, t.memberId),
}));

// ============================================================
// 27. posSaleItems
// ============================================================
export const posSaleItems = sqliteTable('posSaleItems', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  saleId: integer('saleId').notNull(),
  productId: integer('productId').notNull(),
  quantity: integer('quantity').notNull(),
  unitPricePaise: integer('unitPricePaise').notNull(),
  totalPaise: integer('totalPaise').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('posSaleItemsGymIdUnique').on(t.gymId, t.id),
  saleFk: foreignKey({
    columns: [t.gymId, t.saleId],
    foreignColumns: [posSales.gymId, posSales.id],
  }).onDelete('cascade'),
  productFk: foreignKey({
    columns: [t.gymId, t.productId],
    foreignColumns: [products.gymId, products.id],
  }).onDelete('cascade'),
  saleIdx: index('idxPosSaleItemsGymSale').on(t.gymId, t.saleId),
}));

// ============================================================
// 28. expenseCategories
// ============================================================
export const expenseCategories = sqliteTable('expenseCategories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: integer('createdAt').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('expenseCategoriesGymIdUnique').on(t.gymId, t.id),
  nameUq: uniqueIndex('expenseCategoriesGymNameUnique').on(t.gymId, t.name),
}));

// ============================================================
// 29. expenses
// ============================================================
export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  categoryId: integer('categoryId').notNull(),
  title: text('title').notNull(),
  amountPaise: integer('amountPaise').notNull(),
  expenseDate: text('expenseDate').notNull(),
  paymentMode: text('paymentMode', {
    enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER'],
  }).notNull().default('CASH'),
  vendor: text('vendor'),
  receiptUrl: text('receiptUrl'),
  createdByUserId: integer('createdByUserId').references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('createdAt').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('expensesGymIdUnique').on(t.gymId, t.id),
  categoryFk: foreignKey({
    columns: [t.gymId, t.categoryId],
    foreignColumns: [expenseCategories.gymId, expenseCategories.id],
  }).onDelete('cascade'),
  dateIdx: index('idxExpensesGymDate').on(t.gymId, t.expenseDate),
  categoryIdx: index('idxExpensesGymCategory').on(t.gymId, t.categoryId),
}));

// ============================================================
// 30. lockers
// ============================================================
export const lockers = sqliteTable('lockers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  lockerNumber: text('lockerNumber').notNull(),
  zone: text('zone'),
  status: text('status', { enum: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'] }).notNull().default('AVAILABLE'),
  createdAt: integer('createdAt').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('lockersGymIdUnique').on(t.gymId, t.id),
  numberUq: uniqueIndex('lockersGymNumberUnique').on(t.gymId, t.lockerNumber),
}));

// ============================================================
// 31. lockerAllocations
// ============================================================
export const lockerAllocations = sqliteTable('lockerAllocations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gymId: integer('gymId').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  lockerId: integer('lockerId').notNull(),
  memberId: integer('memberId').notNull(),
  startDate: text('startDate').notNull(),
  endDate: text('endDate').notNull(),
  depositPaise: integer('depositPaise').notNull().default(0),
  rentPaise: integer('rentPaise').notNull().default(0),
  status: text('status', { enum: ['ACTIVE', 'TERMINATED', 'OVERDUE'] }).notNull().default('ACTIVE'),
  createdAt: integer('createdAt').notNull(),
}, (t) => ({
  gymIdUq: uniqueIndex('lockerAllocationsGymIdUnique').on(t.gymId, t.id),
  lockerFk: foreignKey({
    columns: [t.gymId, t.lockerId],
    foreignColumns: [lockers.gymId, lockers.id],
  }).onDelete('cascade'),
  memberFk: foreignKey({
    columns: [t.gymId, t.memberId],
    foreignColumns: [members.gymId, members.id],
  }).onDelete('cascade'),
  lockerIdx: index('idxLockerAllocationsGymLocker').on(t.gymId, t.lockerId),
  memberIdx: index('idxLockerAllocationsGymMember').on(t.gymId, t.memberId),
}));

// ============================================================
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
