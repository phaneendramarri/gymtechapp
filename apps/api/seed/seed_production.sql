-- ============================================================================
-- SEED — platform super admin, default tenant, gym owner, starter plans [camelCase]
-- ============================================================================
-- Apply with:   pnpm db:seed:local          (or db:seed:staging / :production)
--
-- Password hashes are NOT stored in this file. They are injected at run time by
-- `apps/api/scripts/seed.mjs`, which derives them with the same PBKDF2-SHA256
-- parameters as `apps/api/src/lib/password.ts` and self-checks the result.
--
-- Default credentials (override with SEED_PASSWORD):
--   Platform admin : admin@gymtech.app  / Password123!
--   Gym owner      : owner@gymtech.app  / Password123!
--
-- Idempotent: INSERT OR REPLACE / INSERT OR IGNORE — safe to re-run.
-- ============================================================================

-- 1. Platform super admin -----------------------------------------------------
INSERT OR REPLACE INTO platformAdmins
  (id, email, passwordHash, name, status, failedLoginCount, createdAt, updatedAt)
VALUES (
  1,
  'admin@gymtech.app',
  '__PLATFORM_ADMIN_PASSWORD_HASH__',
  'Super Admin',
  'ACTIVE',
  0,
  unixepoch(),
  unixepoch()
);

-- 2. Default tenant -----------------------------------------------------------
INSERT OR REPLACE INTO gyms
  (id, name, slug, phone, email, address, city, state, pincode, currency, status, createdAt, updatedAt)
VALUES (
  1,
  'GymTech Fitness Club',
  'gymtech-club',
  '9876543210',
  'contact@gymtech.app',
  'Plot 10, HITEC City',
  'Hyderabad',
  'Telangana',
  '500081',
  'INR',
  'ACTIVE',
  unixepoch(),
  unixepoch()
);

-- 3. Enterprise license (10-year term, generous quotas) ------------------------
INSERT OR REPLACE INTO licenses (
  id, gymId, name, code, pricePaise, billingPeriod,
  maxMembers, maxOwners, maxManagers, maxStaffTotal,
  maxSms, maxWhatsapp, maxEmail, smsUsed, whatsappUsed, emailUsed,
  features, startedAt, expiresAt, status, createdAt, updatedAt
) VALUES (
  1, 1, 'Enterprise Unlimited', 'ENTERPRISE', 4999900, 'YEARLY',
  10000, 5, 20, 50,
  10000, 10000, 10000, 0, 0, 0,
  '{"dashboard":true,"members":true,"attendance":true,"payments":true,"pt_collections":true,"plans":true,"staff":true,"reports":true,"settings":true,"audit_logs":true,"classes":true,"pos":true,"expenses":true,"lockers":true}',
  unixepoch(), unixepoch() + 315360000, 'ACTIVE', unixepoch(), unixepoch()
);

-- 4. OWNER role for the tenant -------------------------------------------------
INSERT OR REPLACE INTO roles
  (id, gymId, name, permissions, isOwner, isDefault, createdAt, updatedAt, deletedAt)
VALUES (1, 1, 'OWNER', '[]', 1, 1, unixepoch(), unixepoch(), NULL);

-- 5. Gym owner user (bound to the OWNER role) ----------------------------------
INSERT OR REPLACE INTO users
  (id, gymId, name, email, phone, passwordHash, roleId, status, isOwner, failedLoginCount, createdAt, updatedAt)
VALUES (
  1,
  1,
  'Gym Owner',
  'owner@gymtech.app',
  '9876543210',
  '__GYM_OWNER_PASSWORD_HASH__',
  1,
  'ACTIVE',
  1,
  0,
  unixepoch(),
  unixepoch()
);

-- 6. Starter membership plans --------------------------------------------------
INSERT OR IGNORE INTO membershipPlans
  (id, gymId, name, description, durationMonths, pricePaise, admissionFeePaise, taxPercentage, isActive, billingPeriod, createdAt, updatedAt)
VALUES
  (1, 1, 'Monthly General', 'Standard monthly gym access', 1, 150000, 0, 0, 1, 'MONTHLY', unixepoch(), unixepoch()),
  (2, 1, 'Quarterly Fitness', 'Three-month fitness membership', 3, 400000, 0, 0, 1, 'MONTHLY', unixepoch(), unixepoch()),
  (3, 1, 'Annual VIP Pass', 'Full-year premium membership', 12, 1200000, 0, 0, 1, 'MONTHLY', unixepoch(), unixepoch());

-- 7. Sequence counters ---------------------------------------------------------
INSERT OR IGNORE INTO counters (gymId, counterType, value) VALUES (1, 'member_code', 0);
INSERT OR IGNORE INTO counters (gymId, counterType, value)
VALUES (1, 'receipt:' || strftime('%Y', 'now'), 0);

-- 8. Complete 14-item menu catalog & owner role assignment -------------------
INSERT OR IGNORE INTO menuItems (id, key, label, href, icon, groupKey, "order", featureKey, adminOnly, isActive, createdAt, updatedAt) VALUES
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

-- Give default gym owner role full menu access in roleMenus
INSERT OR IGNORE INTO roleMenus (gymId, roleId, menuItemId, createdAt)
SELECT 1, 1, id, unixepoch() FROM menuItems WHERE isActive = 1;
