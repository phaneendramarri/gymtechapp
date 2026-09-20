-- ============================================================================
-- GymTech — Canonical Baseline Schema (31 Tables) [100% camelCase Everywhere]
-- ============================================================================
-- Clean, consolidated, single-pass multi-tenant schema for GymTech SaaS.
--
-- Conventions (enforced across all tables):
--   * Table names and column names are strictly camelCase.
--   * Money is stored as INTEGER paise (₹1 = 100 paise).
--   * Timestamps are unix seconds (INTEGER); attendanceDate is YYYYMMDD.
--   * Calendar dates (date-only) are ISO YYYY-MM-DD TEXT strings.
--   * Every tenant-owned table carries `gymId NOT NULL REFERENCES gyms(id) ON DELETE CASCADE`.
--   * Parents referenced by a composite (gymId, id) FK MUST expose a UNIQUE
--     index over those exact columns so SQLite foreign key validation succeeds.
--   * Table order strictly follows foreign key dependency order.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. platformAdmins — SaaS platform super administrators
-- ============================================================================
CREATE TABLE platformAdmins (
    id                  INTEGER PRIMARY KEY,
    email               TEXT NOT NULL UNIQUE,
    passwordHash        TEXT NOT NULL,
    name                TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    failedLoginCount    INTEGER NOT NULL DEFAULT 0 CHECK (failedLoginCount >= 0),
    lockedUntil         INTEGER,
    lastLoginAt         INTEGER,
    authorizedGyms      TEXT,
    createdAt           INTEGER NOT NULL,
    updatedAt           INTEGER NOT NULL,
    deletedAt           INTEGER
);

-- ============================================================================
-- 2. platformSettings — Global key/value config (gateways, SMTP, etc.)
-- ============================================================================
CREATE TABLE platformSettings (
    key         TEXT PRIMARY KEY,
    valueJson   TEXT NOT NULL,
    updatedAt   INTEGER NOT NULL
);

-- ============================================================================
-- 3. gyms — Tenants
-- ============================================================================
CREATE TABLE gyms (
    id                          INTEGER PRIMARY KEY,
    name                        TEXT NOT NULL,
    slug                        TEXT NOT NULL UNIQUE,
    phone                       TEXT NOT NULL,
    email                       TEXT,
    address                     TEXT,
    city                        TEXT,
    state                       TEXT,
    pincode                     TEXT,
    gstNumber                   TEXT,
    currency                    TEXT NOT NULL DEFAULT 'INR',
    logoUrl                     TEXT,
    status                      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','CANCELLED')),
    notificationSettingsJson    TEXT,
    createdAt                   INTEGER NOT NULL,
    updatedAt                   INTEGER NOT NULL,
    deletedAt                   INTEGER
);
CREATE INDEX idxGymsStatus ON gyms(status, deletedAt);

-- ============================================================================
-- 4. licenses — Commercial SaaS subscription per gym (1:1 with gyms)
-- ============================================================================
CREATE TABLE licenses (
    id                      INTEGER PRIMARY KEY,
    gymId                   INTEGER NOT NULL UNIQUE,
    name                    TEXT NOT NULL,
    code                    TEXT NOT NULL,
    pricePaise              INTEGER NOT NULL,
    billingPeriod           TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (billingPeriod IN ('MONTHLY','YEARLY')),
    maxMembers              INTEGER NOT NULL,
    maxOwners               INTEGER NOT NULL DEFAULT 1,
    maxManagers             INTEGER NOT NULL,
    maxStaffTotal           INTEGER NOT NULL,
    maxSms                  INTEGER NOT NULL,
    maxWhatsapp             INTEGER NOT NULL,
    maxEmail                INTEGER NOT NULL,
    smsUsed                 INTEGER NOT NULL DEFAULT 0,
    whatsappUsed            INTEGER NOT NULL DEFAULT 0,
    emailUsed               INTEGER NOT NULL DEFAULT 0,
    features                TEXT NOT NULL DEFAULT '{}',
    startedAt               INTEGER NOT NULL,
    expiresAt               INTEGER NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRED','SUSPENDED')),
    renewalReminderSentAt   INTEGER,
    trialEndsAt             INTEGER,
    createdByAdminId        INTEGER,
    createdAt               INTEGER NOT NULL,
    updatedAt               INTEGER NOT NULL,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX licensesCodeUnique ON licenses(code);

-- ============================================================================
-- 5. roles — Owner-defined roles per gym
-- ============================================================================
CREATE TABLE roles (
    id           INTEGER PRIMARY KEY,
    gymId        INTEGER NOT NULL,
    name         TEXT NOT NULL,
    permissions  TEXT NOT NULL DEFAULT '[]',
    isOwner      INTEGER NOT NULL DEFAULT 0,
    isDefault    INTEGER NOT NULL DEFAULT 0,
    createdAt    INTEGER NOT NULL,
    updatedAt    INTEGER NOT NULL,
    deletedAt    INTEGER,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX rolesGymNameUnique ON roles(gymId, name) WHERE deletedAt IS NULL;
CREATE INDEX idxRolesGym ON roles(gymId, deletedAt);

-- ============================================================================
-- 6. users — Gym staff & owners
-- ============================================================================
CREATE TABLE users (
    id                  INTEGER PRIMARY KEY,
    gymId               INTEGER NOT NULL,
    name                TEXT NOT NULL,
    email               TEXT NOT NULL,
    phone               TEXT,
    passwordHash        TEXT NOT NULL,
    roleId              INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    isOwner             INTEGER NOT NULL DEFAULT 0,
    lastLoginAt         INTEGER,
    failedLoginCount    INTEGER NOT NULL DEFAULT 0 CHECK (failedLoginCount >= 0),
    lockedUntil         INTEGER,
    createdAt           INTEGER NOT NULL,
    updatedAt           INTEGER NOT NULL,
    deletedAt           INTEGER,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX usersGymIdUnique    ON users(gymId, id);
CREATE UNIQUE INDEX usersGymEmailUnique ON users(gymId, email);
CREATE INDEX idxUsersGymOwner  ON users(gymId, isOwner);
CREATE INDEX idxUsersGymStatus ON users(gymId, status, deletedAt);
CREATE INDEX idxUsersGymRole   ON users(gymId, roleId);

-- ============================================================================
-- 7. userSessions — Access & refresh token registry
-- ============================================================================
CREATE TABLE userSessions (
    id                      INTEGER PRIMARY KEY,
    gymId                   INTEGER NOT NULL DEFAULT 0,
    userId                  INTEGER NOT NULL,
    tokenHash               TEXT NOT NULL UNIQUE,
    refreshTokenHash        TEXT,
    refreshTokenExpiresAt   INTEGER,
    ip                      TEXT,
    userAgent               TEXT,
    issuedAt                INTEGER NOT NULL,
    expiresAt               INTEGER NOT NULL,
    revokedAt               INTEGER,
    userType                TEXT NOT NULL DEFAULT 'GYM_USER' CHECK (userType IN ('GYM_USER','PLATFORM_ADMIN'))
);
CREATE INDEX idxUserSessionsGymUser ON userSessions(gymId, userId);
CREATE INDEX idxUserSessionsExpires  ON userSessions(expiresAt);

-- ============================================================================
-- 8. userPasswordResets — Cryptographic password reset tokens
-- ============================================================================
CREATE TABLE userPasswordResets (
    id          INTEGER PRIMARY KEY,
    gymId       INTEGER NOT NULL,
    userId      INTEGER NOT NULL,
    tokenHash   TEXT NOT NULL UNIQUE,
    expiresAt   INTEGER NOT NULL,
    usedAt      INTEGER,
    createdAt   INTEGER NOT NULL,
    FOREIGN KEY (gymId, userId) REFERENCES users(gymId, id) ON DELETE CASCADE
);

-- ============================================================================
-- 9. auditEvents — Append-only audit trail
-- ============================================================================
CREATE TABLE auditEvents (
    id            INTEGER PRIMARY KEY,
    gymId         INTEGER NOT NULL,
    actorUserId   INTEGER,
    actorRole     TEXT,
    action        TEXT NOT NULL,
    entityType    TEXT NOT NULL,
    entityId      INTEGER,
    beforeState   TEXT,
    afterState    TEXT,
    ip            TEXT,
    userAgent     TEXT,
    deviceInfo    TEXT,
    metadata      TEXT,
    createdAt     INTEGER NOT NULL
);
CREATE INDEX idxAuditGymCreated        ON auditEvents(gymId, createdAt);
CREATE INDEX idxAuditGymActionCreated ON auditEvents(gymId, action, createdAt);
CREATE INDEX idxAuditGymEntity         ON auditEvents(gymId, entityType, entityId);

-- ============================================================================
-- 10. counters — Atomic sequences (member codes, receipts)
-- ============================================================================
CREATE TABLE counters (
    gymId         INTEGER NOT NULL,
    counterType   TEXT NOT NULL,
    value         INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (gymId, counterType),
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE
);

-- ============================================================================
-- 11. membershipPlans — Gym-level catalog sold to members
-- ============================================================================
CREATE TABLE membershipPlans (
    id                  INTEGER PRIMARY KEY,
    gymId               INTEGER NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    durationMonths      INTEGER NOT NULL CHECK (durationMonths > 0),
    pricePaise          INTEGER NOT NULL,
    admissionFeePaise   INTEGER NOT NULL DEFAULT 0,
    taxPercentage       REAL NOT NULL DEFAULT 0,
    isActive            INTEGER NOT NULL DEFAULT 1,
    billingPeriod       TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (billingPeriod IN ('MONTHLY','YEARLY')),
    createdAt           INTEGER NOT NULL,
    updatedAt           INTEGER NOT NULL,
    deletedAt           INTEGER,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX membershipPlansGymIdUnique   ON membershipPlans(gymId, id);
CREATE UNIQUE INDEX membershipPlansGymNameUnique ON membershipPlans(gymId, name);
CREATE INDEX idxMembershipPlansGymActive ON membershipPlans(gymId, isActive, deletedAt);

-- ============================================================================
-- 12. members — Gym customers
-- ============================================================================
CREATE TABLE members (
    id                        INTEGER PRIMARY KEY,
    gymId                     INTEGER NOT NULL,
    memberCode                TEXT NOT NULL,
    firstName                 TEXT NOT NULL,
    lastName                  TEXT,
    email                     TEXT,
    phone                     TEXT NOT NULL,
    gender                    TEXT CHECK (gender IS NULL OR gender IN ('MALE','FEMALE','OTHER')),
    dateOfBirth               INTEGER,
    photoUrl                  TEXT,
    faceEmbedding             TEXT,
    biometricConsentGiven     INTEGER NOT NULL DEFAULT 0,
    biometricConsentAt        INTEGER,
    biometricConsentVersion   TEXT DEFAULT '1.0',
    address                   TEXT,
    city                      TEXT,
    pincode                   TEXT,
    emergencyContactName      TEXT,
    emergencyContactPhone     TEXT,
    healthNotes               TEXT,
    status                    TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','BLOCKED','EXPIRED','FROZEN','CANCELLED')),
    joinedDate                INTEGER NOT NULL,
    createdAt                 INTEGER NOT NULL,
    updatedAt                 INTEGER NOT NULL,
    deletedAt                 INTEGER,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX membersGymIdUnique          ON members(gymId, id);
CREATE UNIQUE INDEX membersGymMemberCodeUnique ON members(gymId, memberCode);
CREATE UNIQUE INDEX membersGymPhoneUnique       ON members(gymId, phone);
CREATE INDEX idxMembersGymStatus ON members(gymId, status, deletedAt);
CREATE INDEX idxMembersGymName   ON members(gymId, lastName, firstName);

-- ============================================================================
-- 13. memberships — Member subscriptions to plans
-- ============================================================================
CREATE TABLE memberships (
    id                  INTEGER PRIMARY KEY,
    gymId               INTEGER NOT NULL,
    memberId            INTEGER NOT NULL,
    membershipPlanId    INTEGER NOT NULL,
    startDate           INTEGER NOT NULL,
    endDate             INTEGER NOT NULL,
    totalAmountPaise    INTEGER NOT NULL,
    discountPaise       INTEGER NOT NULL DEFAULT 0,
    finalAmountPaise    INTEGER NOT NULL,
    paidAmountPaise     INTEGER NOT NULL DEFAULT 0,
    dueAmountPaise      INTEGER NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRED','FROZEN','CANCELLED')),
    frozenAt            INTEGER,
    notes               TEXT,
    createdByUserId     INTEGER,
    createdAt           INTEGER NOT NULL,
    updatedAt           INTEGER NOT NULL,
    deletedAt           INTEGER,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, memberId)         REFERENCES members(gymId, id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, membershipPlanId) REFERENCES membershipPlans(gymId, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX membershipsGymIdUnique ON memberships(gymId, id);
CREATE INDEX idxMembershipsGymMember        ON memberships(gymId, memberId);
CREATE INDEX idxMembershipsGymStatusDates  ON memberships(gymId, status, endDate);
CREATE INDEX idxMembershipsGymEndDate      ON memberships(gymId, endDate);

-- ============================================================================
-- 14. payments — Fee receipts & dues payments
-- ============================================================================
CREATE TABLE payments (
    id                  INTEGER PRIMARY KEY,
    gymId               INTEGER NOT NULL,
    memberId            INTEGER NOT NULL,
    membershipId        INTEGER,
    paymentType         TEXT NOT NULL DEFAULT 'GYM' CHECK (paymentType IN ('GYM','PERSONAL_TRAINING')),
    receiptNumber       TEXT NOT NULL,
    amountPaise         INTEGER NOT NULL,
    paymentDate         INTEGER NOT NULL,
    paymentMode         TEXT NOT NULL CHECK (paymentMode IN ('CASH','UPI','CARD','BANK_TRANSFER','OTHER')),
    referenceId         TEXT,
    status              TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED','REFUNDED','VOID')),
    recordedByUserId    INTEGER,
    notes               TEXT,
    createdAt           INTEGER NOT NULL,
    updatedAt           INTEGER NOT NULL,
    deletedAt           INTEGER,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, memberId)     REFERENCES members(gymId, id) ON DELETE RESTRICT,
    FOREIGN KEY (gymId, membershipId) REFERENCES memberships(gymId, id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX paymentsGymIdUnique      ON payments(gymId, id);
CREATE UNIQUE INDEX paymentsGymReceiptUnique ON payments(gymId, receiptNumber);
CREATE INDEX idxPaymentsGymDate        ON payments(gymId, paymentDate);
CREATE INDEX idxPaymentsGymMemberDate ON payments(gymId, memberId, paymentDate);
CREATE INDEX idxPaymentsGymStatusDate ON payments(gymId, status, paymentDate);

-- ============================================================================
-- 15. ptCollections — PT payments + trainer commissions
-- ============================================================================
CREATE TABLE ptCollections (
    id                     INTEGER PRIMARY KEY,
    gymId                  INTEGER NOT NULL,
    memberId               INTEGER NOT NULL,
    trainerId              INTEGER NOT NULL,
    sessions               INTEGER NOT NULL DEFAULT 0,
    amountPaise            INTEGER NOT NULL,
    commissionPercentage   REAL NOT NULL DEFAULT 0,
    commissionPaise        INTEGER NOT NULL DEFAULT 0,
    commissionStatus       TEXT NOT NULL DEFAULT 'PENDING' CHECK (commissionStatus IN ('PENDING','PAID')),
    paymentMode            TEXT NOT NULL DEFAULT 'CASH' CHECK (paymentMode IN ('CASH','UPI','CARD','BANK_TRANSFER','OTHER')),
    paymentDate            INTEGER NOT NULL,
    receiptNumber          TEXT,
    notes                  TEXT,
    recordedByUserId       INTEGER,
    createdAt              INTEGER NOT NULL,
    updatedAt              INTEGER NOT NULL,
    deletedAt              INTEGER,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, memberId)  REFERENCES members(gymId, id) ON DELETE RESTRICT,
    FOREIGN KEY (gymId, trainerId) REFERENCES users(gymId, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX ptCollectionsGymIdUnique ON ptCollections(gymId, id);
CREATE INDEX idxPtCollectionsGymDate    ON ptCollections(gymId, paymentDate);
CREATE INDEX idxPtCollectionsGymTrainer ON ptCollections(gymId, trainerId, commissionStatus);
CREATE UNIQUE INDEX ptCollectionsGymReceiptUnique
  ON ptCollections(gymId, receiptNumber) WHERE receiptNumber IS NOT NULL;

-- ============================================================================
-- 16. attendance — Floor check-ins
-- ============================================================================
CREATE TABLE attendance (
    id                  INTEGER PRIMARY KEY,
    gymId               INTEGER NOT NULL,
    memberId            INTEGER NOT NULL,
    checkInTime         INTEGER NOT NULL,
    checkOutTime        INTEGER,
    attendanceDate      INTEGER NOT NULL,
    method              TEXT NOT NULL CHECK (method IN ('MANUAL','QR','FACE_ID','KIOSK')),
    recordedByUserId    INTEGER,
    deviceInfo          TEXT,
    createdAt           INTEGER NOT NULL,
    deletedAt           INTEGER,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, memberId) REFERENCES members(gymId, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX attendanceGymIdUnique    ON attendance(gymId, id);
CREATE INDEX idxAttendanceGymDate        ON attendance(gymId, attendanceDate);
CREATE INDEX idxAttendanceGymMemberDate ON attendance(gymId, memberId, attendanceDate);
CREATE INDEX idxAttendanceGymCheckin     ON attendance(gymId, checkInTime);

-- ============================================================================
-- 17. communicationLogs — SMS/WhatsApp/Email dispatch log
-- ============================================================================
CREATE TABLE communicationLogs (
    id                 INTEGER PRIMARY KEY,
    gymId              INTEGER NOT NULL,
    memberId           INTEGER,
    channel            TEXT NOT NULL CHECK (channel IN ('SMS','WHATSAPP','EMAIL')),
    recipientPhone     TEXT,
    recipientName      TEXT,
    messageType        TEXT NOT NULL,
    creditsDeducted    INTEGER NOT NULL DEFAULT 1,
    remainingBalance   INTEGER NOT NULL,
    lawfulBasis        TEXT,
    retentionUntil     INTEGER,
    dispatchedById     INTEGER,
    ip                 TEXT,
    createdAt          INTEGER NOT NULL,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, memberId) REFERENCES members(gymId, id)
);
CREATE UNIQUE INDEX communicationLogsGymIdUnique ON communicationLogs(gymId, id);
CREATE INDEX idxCommLogsGym    ON communicationLogs(gymId, createdAt);
CREATE INDEX idxCommLogsMember ON communicationLogs(memberId);

-- ============================================================================
-- 18. menuItems — System navigation & features catalog
-- ============================================================================
CREATE TABLE menuItems (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    key          TEXT NOT NULL UNIQUE,
    label        TEXT NOT NULL,
    href         TEXT,
    icon         TEXT,
    groupKey     TEXT NOT NULL DEFAULT 'main',
    "order"      INTEGER NOT NULL DEFAULT 10,
    featureKey   TEXT,
    adminOnly    INTEGER NOT NULL DEFAULT 0,
    isActive     INTEGER NOT NULL DEFAULT 1,
    createdAt    INTEGER NOT NULL,
    updatedAt    INTEGER NOT NULL
);
CREATE INDEX idxMenuItemsGroupOrder ON menuItems(groupKey, "order");

-- Seed the complete 14-item navigation & feature catalog
INSERT INTO menuItems (id, key, label, href, icon, groupKey, "order", featureKey, adminOnly, isActive, createdAt, updatedAt) VALUES
  (1,  'dashboard',      'Dashboard',          '/dashboard',      'LayoutDashboard', 'main',  10, null,             0, 1, unixepoch(), unixepoch()),
  (2,  'members',        'Members Directory',  '/members',        'Users',           'main',  20, 'members',        0, 1, unixepoch(), unixepoch()),
  (3,  'attendance',     'Floor & Attendance', '/attendance',     'CalendarCheck',   'main',  30, 'attendance',     0, 1, unixepoch(), unixepoch()),
  (4,  'classes',        'Group Classes',      '/classes',        'Calendar',        'main',  35, 'classes',        0, 1, unixepoch(), unixepoch()),
  (5,  'payments',       'Payments & Billing', '/payments',       'CreditCard',      'main',  40, 'payments',       0, 1, unixepoch(), unixepoch()),
  (6,  'pos',            'POS & Store',        '/pos',            'ShoppingBag',     'main',  45, 'pos',            0, 1, unixepoch(), unixepoch()),
  (7,  'pt_collections', 'PT Collections',     '/pt-collections', 'Trophy',          'main',  50, 'pt_collections', 0, 1, unixepoch(), unixepoch()),
  (8,  'plans',          'Membership Plans',   '/plans',          'Tag',             'main',  60, 'plans',          0, 1, unixepoch(), unixepoch()),
  (9,  'reports',        'Financial Reports',  '/reports',        'BarChart3',       'main',  70, 'reports',        0, 1, unixepoch(), unixepoch()),
  (10, 'expenses',       'Expenses & P&L',     '/expenses',       'Receipt',         'main',  75, 'expenses',       0, 1, unixepoch(), unixepoch()),
  (11, 'staff',          'Staff Management',   '/staff',          'UserCog',         'admin', 80, 'staff',          0, 1, unixepoch(), unixepoch()),
  (12, 'lockers',        'Locker System',      '/lockers',        'Lock',            'main',  85, 'lockers',        0, 1, unixepoch(), unixepoch()),
  (13, 'settings',       'Gym Settings',       '/settings',       'Settings',        'admin', 90, 'settings',       0, 1, unixepoch(), unixepoch()),
  (14, 'audit_logs',     'Audit Logs',         '/audit-logs',     'Sliders',         'admin', 100,'audit_logs',     0, 1, unixepoch(), unixepoch());

-- ============================================================================
-- 19. roleMenus — Junction table (gym role -> menu item)
-- ============================================================================
CREATE TABLE roleMenus (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    gymId        INTEGER NOT NULL,
    roleId       INTEGER NOT NULL,
    menuItemId   INTEGER NOT NULL,
    createdAt    INTEGER NOT NULL,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (menuItemId) REFERENCES menuItems(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX roleMenusRoleMenuUnique ON roleMenus(gymId, roleId, menuItemId);
CREATE INDEX idxRoleMenusGymRole ON roleMenus(gymId, roleId);
CREATE INDEX idxRoleMenusGymMenu ON roleMenus(gymId, menuItemId);

-- ============================================================================
-- 20. classes — Group fitness offerings
-- ============================================================================
CREATE TABLE classes (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    gymId             INTEGER NOT NULL,
    name              TEXT NOT NULL,
    description       TEXT,
    durationMinutes   INTEGER NOT NULL DEFAULT 60 CHECK (durationMinutes > 0),
    maxCapacity       INTEGER NOT NULL DEFAULT 20 CHECK (maxCapacity > 0),
    color             TEXT NOT NULL DEFAULT '#4f46e5',
    isActive          INTEGER NOT NULL DEFAULT 1,
    createdAt         INTEGER NOT NULL,
    updatedAt         INTEGER NOT NULL,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX classesGymIdUnique ON classes(gymId, id);
CREATE INDEX idxClassesGymName ON classes(gymId, name);

-- ============================================================================
-- 21. classSchedules — Weekly timetables & one-off classes
-- ============================================================================
CREATE TABLE classSchedules (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    gymId            INTEGER NOT NULL,
    classId          INTEGER NOT NULL,
    trainerUserId    INTEGER,
    dayOfWeek        INTEGER NOT NULL CHECK (dayOfWeek BETWEEN 0 AND 6),
    startTime        TEXT NOT NULL,
    endTime          TEXT NOT NULL,
    date             TEXT,
    maxCapacity      INTEGER NOT NULL DEFAULT 20 CHECK (maxCapacity > 0),
    isCancelled      INTEGER NOT NULL DEFAULT 0,
    createdAt        INTEGER NOT NULL,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, classId)       REFERENCES classes(gymId, id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, trainerUserId) REFERENCES users(gymId, id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX classSchedulesGymIdUnique ON classSchedules(gymId, id);
CREATE INDEX idxClassSchedulesGymClass   ON classSchedules(gymId, classId);
CREATE INDEX idxClassSchedulesGymDay     ON classSchedules(gymId, dayOfWeek);
CREATE INDEX idxClassSchedulesGymTrainer ON classSchedules(gymId, trainerUserId);

-- ============================================================================
-- 22. classBookings — Member reservations for scheduled classes
-- ============================================================================
CREATE TABLE classBookings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    gymId         INTEGER NOT NULL,
    scheduleId    INTEGER NOT NULL,
    memberId      INTEGER NOT NULL,
    status        TEXT NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED','ATTENDED','CANCELLED','NO_SHOW','WAITLIST')),
    bookedAt      INTEGER NOT NULL,
    attendedAt    INTEGER,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, scheduleId) REFERENCES classSchedules(gymId, id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, memberId)   REFERENCES members(gymId, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX classBookingsGymIdUnique ON classBookings(gymId, id);
CREATE INDEX idxClassBookingsGymSchedule ON classBookings(gymId, scheduleId);
CREATE INDEX idxClassBookingsGymMember   ON classBookings(gymId, memberId);

-- ============================================================================
-- 23. ptPackages — Personal training package agreements
-- ============================================================================
CREATE TABLE ptPackages (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    gymId               INTEGER NOT NULL,
    memberId            INTEGER NOT NULL,
    trainerUserId       INTEGER NOT NULL,
    packageName         TEXT NOT NULL DEFAULT 'Personal Training',
    totalSessions       INTEGER NOT NULL CHECK (totalSessions > 0),
    completedSessions   INTEGER NOT NULL DEFAULT 0 CHECK (completedSessions >= 0),
    pricePaise          INTEGER NOT NULL CHECK (pricePaise >= 0),
    startDate           TEXT NOT NULL,
    expiryDate          TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','COMPLETED','EXPIRED')),
    notes               TEXT,
    createdAt           INTEGER NOT NULL,
    updatedAt           INTEGER NOT NULL,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, memberId)      REFERENCES members(gymId, id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, trainerUserId) REFERENCES users(gymId, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX ptPackagesGymIdUnique ON ptPackages(gymId, id);
CREATE INDEX idxPtPackagesGymMember  ON ptPackages(gymId, memberId);
CREATE INDEX idxPtPackagesGymTrainer ON ptPackages(gymId, trainerUserId);

-- ============================================================================
-- 24. ptSessions — Individual workout logs against a PT package
-- ============================================================================
CREATE TABLE ptSessions (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    gymId                 INTEGER NOT NULL,
    packageId             INTEGER NOT NULL,
    sessionNumber         INTEGER NOT NULL CHECK (sessionNumber > 0),
    sessionDate           TEXT NOT NULL,
    notes                 TEXT,
    trainerUserId         INTEGER NOT NULL,
    signedOffByMember     INTEGER NOT NULL DEFAULT 1,
    createdAt             INTEGER NOT NULL,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, packageId)     REFERENCES ptPackages(gymId, id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, trainerUserId) REFERENCES users(gymId, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX ptSessionsGymIdUnique ON ptSessions(gymId, id);
CREATE INDEX idxPtSessionsGymPackage ON ptSessions(gymId, packageId);

-- ============================================================================
-- 25. products — POS retail & supplement inventory
-- ============================================================================
CREATE TABLE products (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    gymId                INTEGER NOT NULL,
    name                 TEXT NOT NULL,
    sku                  TEXT,
    category             TEXT NOT NULL DEFAULT 'General',
    pricePaise           INTEGER NOT NULL CHECK (pricePaise >= 0),
    costPaise            INTEGER NOT NULL DEFAULT 0 CHECK (costPaise >= 0),
    stockQuantity        INTEGER NOT NULL DEFAULT 0 CHECK (stockQuantity >= 0),
    lowStockThreshold    INTEGER NOT NULL DEFAULT 5 CHECK (lowStockThreshold >= 0),
    taxRate              REAL NOT NULL DEFAULT 0,
    isActive             INTEGER NOT NULL DEFAULT 1,
    createdAt            INTEGER NOT NULL,
    updatedAt            INTEGER NOT NULL,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX productsGymIdUnique ON products(gymId, id);
CREATE INDEX idxProductsGymName ON products(gymId, name);

-- ============================================================================
-- 26. posSales — Point of sale orders
-- ============================================================================
CREATE TABLE posSales (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    gymId           INTEGER NOT NULL,
    receiptNumber   TEXT NOT NULL,
    memberId        INTEGER,
    subtotalPaise   INTEGER NOT NULL CHECK (subtotalPaise >= 0),
    taxPaise        INTEGER NOT NULL DEFAULT 0 CHECK (taxPaise >= 0),
    totalPaise      INTEGER NOT NULL CHECK (totalPaise >= 0),
    paymentMode     TEXT NOT NULL DEFAULT 'CASH' CHECK (paymentMode IN ('CASH','UPI','CARD','BANK_TRANSFER','OTHER')),
    notes           TEXT,
    createdAt       INTEGER NOT NULL,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, memberId) REFERENCES members(gymId, id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX posSalesGymIdUnique      ON posSales(gymId, id);
CREATE UNIQUE INDEX posSalesGymReceiptUnique ON posSales(gymId, receiptNumber);
CREATE INDEX idxPosSalesGymMember ON posSales(gymId, memberId);

-- ============================================================================
-- 27. posSaleItems — Line items in a POS sale
-- ============================================================================
CREATE TABLE posSaleItems (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    gymId             INTEGER NOT NULL,
    saleId            INTEGER NOT NULL,
    productId         INTEGER NOT NULL,
    quantity          INTEGER NOT NULL CHECK (quantity > 0),
    unitPricePaise    INTEGER NOT NULL CHECK (unitPricePaise >= 0),
    totalPaise        INTEGER NOT NULL CHECK (totalPaise >= 0),
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, saleId)    REFERENCES posSales(gymId, id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, productId) REFERENCES products(gymId, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX posSaleItemsGymIdUnique ON posSaleItems(gymId, id);
CREATE INDEX idxPosSaleItemsGymSale ON posSaleItems(gymId, saleId);

-- ============================================================================
-- 28. expenseCategories — Gym expenditure categories
-- ============================================================================
CREATE TABLE expenseCategories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    gymId       INTEGER NOT NULL,
    name        TEXT NOT NULL,
    createdAt   INTEGER NOT NULL,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX expenseCategoriesGymIdUnique   ON expenseCategories(gymId, id);
CREATE UNIQUE INDEX expenseCategoriesGymNameUnique ON expenseCategories(gymId, name);

-- ============================================================================
-- 29. expenses — Gym expenses (for P&L)
-- ============================================================================
CREATE TABLE expenses (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    gymId               INTEGER NOT NULL,
    categoryId          INTEGER NOT NULL,
    title               TEXT NOT NULL,
    amountPaise         INTEGER NOT NULL CHECK (amountPaise >= 0),
    expenseDate         TEXT NOT NULL,
    paymentMode         TEXT NOT NULL DEFAULT 'CASH' CHECK (paymentMode IN ('CASH','UPI','CARD','BANK_TRANSFER','OTHER')),
    vendor              TEXT,
    receiptUrl          TEXT,
    createdByUserId     INTEGER,
    createdAt           INTEGER NOT NULL,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, categoryId)      REFERENCES expenseCategories(gymId, id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, createdByUserId) REFERENCES users(gymId, id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX expensesGymIdUnique ON expenses(gymId, id);
CREATE INDEX idxExpensesGymDate     ON expenses(gymId, expenseDate);
CREATE INDEX idxExpensesGymCategory ON expenses(gymId, categoryId);

-- ============================================================================
-- 30. lockers — Physical lockers
-- ============================================================================
CREATE TABLE lockers (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    gymId          INTEGER NOT NULL,
    lockerNumber   TEXT NOT NULL,
    zone           TEXT,
    status         TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','OCCUPIED','MAINTENANCE')),
    createdAt      INTEGER NOT NULL,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX lockersGymIdUnique     ON lockers(gymId, id);
CREATE UNIQUE INDEX lockersGymNumberUnique ON lockers(gymId, lockerNumber);

-- ============================================================================
-- 31. lockerAllocations — Locker rentals to members
-- ============================================================================
CREATE TABLE lockerAllocations (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    gymId          INTEGER NOT NULL,
    lockerId       INTEGER NOT NULL,
    memberId       INTEGER NOT NULL,
    startDate      TEXT NOT NULL,
    endDate        TEXT NOT NULL,
    depositPaise   INTEGER NOT NULL DEFAULT 0 CHECK (depositPaise >= 0),
    rentPaise      INTEGER NOT NULL DEFAULT 0 CHECK (rentPaise >= 0),
    status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','TERMINATED','OVERDUE')),
    createdAt      INTEGER NOT NULL,
    FOREIGN KEY (gymId) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, lockerId) REFERENCES lockers(gymId, id) ON DELETE CASCADE,
    FOREIGN KEY (gymId, memberId) REFERENCES members(gymId, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX lockerAllocationsGymIdUnique ON lockerAllocations(gymId, id);
CREATE INDEX idxLockerAllocationsGymLocker ON lockerAllocations(gymId, lockerId);
CREATE INDEX idxLockerAllocationsGymMember ON lockerAllocations(gymId, memberId);
