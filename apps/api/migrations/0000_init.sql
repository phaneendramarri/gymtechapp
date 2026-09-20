-- ============================================================================
-- GymTech — Canonical Baseline Schema (31 Tables)
-- ============================================================================
-- Clean, consolidated, single-pass multi-tenant schema for GymTech SaaS.
--
-- Conventions (enforced across all tables):
--   * Money is stored as INTEGER paise (₹1 = 100 paise).
--   * Timestamps are unix seconds (INTEGER); attendance_date is YYYYMMDD.
--   * Calendar dates (date-only) are ISO YYYY-MM-DD TEXT strings.
--   * Every tenant-owned table carries `gym_id NOT NULL REFERENCES gyms(id) ON DELETE CASCADE`.
--   * Parents referenced by a composite (gym_id, id) FK MUST expose a UNIQUE
--     index over those exact columns so SQLite foreign key validation succeeds.
--   * Table order strictly follows foreign key dependency order.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. platform_admins — SaaS platform super administrators
-- ============================================================================
CREATE TABLE platform_admins (
    id                  INTEGER PRIMARY KEY,
    email               TEXT NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    name                TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    failed_login_count  INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
    locked_until        INTEGER,
    last_login_at       INTEGER,
    authorized_gyms     TEXT,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL,
    deleted_at          INTEGER
);

-- ============================================================================
-- 2. platform_settings — Global key/value config (gateways, SMTP, etc.)
-- ============================================================================
CREATE TABLE platform_settings (
    key         TEXT PRIMARY KEY,
    value_json  TEXT NOT NULL,
    updated_at  INTEGER NOT NULL
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
    gst_number                  TEXT,
    currency                    TEXT NOT NULL DEFAULT 'INR',
    logo_url                    TEXT,
    status                      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','CANCELLED')),
    notification_settings_json  TEXT,
    created_at                  INTEGER NOT NULL,
    updated_at                  INTEGER NOT NULL,
    deleted_at                  INTEGER
);
CREATE INDEX idx_gyms_status ON gyms(status, deleted_at);

-- ============================================================================
-- 4. licenses — Commercial SaaS subscription per gym (1:1 with gyms)
-- ============================================================================
CREATE TABLE licenses (
    id                        INTEGER PRIMARY KEY,
    gym_id                    INTEGER NOT NULL UNIQUE,
    name                      TEXT NOT NULL,
    code                      TEXT NOT NULL,
    price_paise               INTEGER NOT NULL,
    billing_period            TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (billing_period IN ('MONTHLY','YEARLY')),
    max_members               INTEGER NOT NULL,
    max_owners                INTEGER NOT NULL DEFAULT 1,
    max_managers              INTEGER NOT NULL,
    max_staff_total           INTEGER NOT NULL,
    max_sms                   INTEGER NOT NULL,
    max_whatsapp              INTEGER NOT NULL,
    max_email                 INTEGER NOT NULL,
    sms_used                  INTEGER NOT NULL DEFAULT 0,
    whatsapp_used             INTEGER NOT NULL DEFAULT 0,
    email_used                INTEGER NOT NULL DEFAULT 0,
    features                  TEXT NOT NULL DEFAULT '{}',
    started_at                INTEGER NOT NULL,
    expires_at                INTEGER NOT NULL,
    status                    TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRED','SUSPENDED')),
    renewal_reminder_sent_at  INTEGER,
    trial_ends_at             INTEGER,
    created_by_admin_id       INTEGER,
    created_at                INTEGER NOT NULL,
    updated_at                INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX licenses_code_unique ON licenses(code);

-- ============================================================================
-- 5. roles — Owner-defined roles per gym
-- ============================================================================
CREATE TABLE roles (
    id           INTEGER PRIMARY KEY,
    gym_id       INTEGER NOT NULL,
    name         TEXT NOT NULL,
    permissions  TEXT NOT NULL DEFAULT '[]',
    is_owner     INTEGER NOT NULL DEFAULT 0,
    is_default   INTEGER NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    deleted_at   INTEGER,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX roles_gym_name_unique ON roles(gym_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_roles_gym ON roles(gym_id, deleted_at);

-- ============================================================================
-- 6. users — Gym staff & owners
-- ============================================================================
CREATE TABLE users (
    id                  INTEGER PRIMARY KEY,
    gym_id              INTEGER NOT NULL,
    name                TEXT NOT NULL,
    email               TEXT NOT NULL,
    phone               TEXT,
    password_hash       TEXT NOT NULL,
    role_id             INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    is_owner            INTEGER NOT NULL DEFAULT 0,
    last_login_at       INTEGER,
    failed_login_count  INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
    locked_until        INTEGER,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL,
    deleted_at          INTEGER,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX users_gym_id_unique    ON users(gym_id, id);
CREATE UNIQUE INDEX users_gym_email_unique ON users(gym_id, email);
CREATE INDEX idx_users_gym_owner  ON users(gym_id, is_owner);
CREATE INDEX idx_users_gym_status ON users(gym_id, status, deleted_at);
CREATE INDEX idx_users_gym_role   ON users(gym_id, role_id);

-- ============================================================================
-- 7. user_sessions — Access & refresh token registry
-- ============================================================================
CREATE TABLE user_sessions (
    id                        INTEGER PRIMARY KEY,
    gym_id                    INTEGER NOT NULL DEFAULT 0,
    user_id                   INTEGER NOT NULL,
    token_hash                TEXT NOT NULL UNIQUE,
    refresh_token_hash        TEXT,
    refresh_token_expires_at  INTEGER,
    ip                        TEXT,
    user_agent                TEXT,
    issued_at                 INTEGER NOT NULL,
    expires_at                INTEGER NOT NULL,
    revoked_at                INTEGER,
    user_type                 TEXT NOT NULL DEFAULT 'GYM_USER' CHECK (user_type IN ('GYM_USER','PLATFORM_ADMIN'))
);
CREATE INDEX idx_user_sessions_gym_user ON user_sessions(gym_id, user_id);
CREATE INDEX idx_user_sessions_expires  ON user_sessions(expires_at);

-- ============================================================================
-- 8. user_password_resets — Cryptographic password reset tokens
-- ============================================================================
CREATE TABLE user_password_resets (
    id          INTEGER PRIMARY KEY,
    gym_id      INTEGER NOT NULL,
    user_id     INTEGER NOT NULL,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  INTEGER NOT NULL,
    used_at     INTEGER,
    created_at  INTEGER NOT NULL,
    FOREIGN KEY (gym_id, user_id) REFERENCES users(gym_id, id) ON DELETE CASCADE
);

-- ============================================================================
-- 9. audit_events — Append-only audit trail
-- ============================================================================
CREATE TABLE audit_events (
    id            INTEGER PRIMARY KEY,
    gym_id        INTEGER NOT NULL,
    actor_user_id INTEGER,
    actor_role    TEXT,
    action        TEXT NOT NULL,
    entity_type   TEXT NOT NULL,
    entity_id     INTEGER,
    before_state  TEXT,
    after_state   TEXT,
    ip            TEXT,
    user_agent    TEXT,
    device_info   TEXT,
    metadata      TEXT,
    created_at    INTEGER NOT NULL
);
CREATE INDEX idx_audit_gym_created        ON audit_events(gym_id, created_at);
CREATE INDEX idx_audit_gym_action_created ON audit_events(gym_id, action, created_at);
CREATE INDEX idx_audit_gym_entity         ON audit_events(gym_id, entity_type, entity_id);

-- ============================================================================
-- 10. counters — Atomic sequences (member codes, receipts)
-- ============================================================================
CREATE TABLE counters (
    gym_id        INTEGER NOT NULL,
    counter_type  TEXT NOT NULL,
    value         INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (gym_id, counter_type),
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);

-- ============================================================================
-- 11. membership_plans — Gym-level catalog sold to members
-- ============================================================================
CREATE TABLE membership_plans (
    id                  INTEGER PRIMARY KEY,
    gym_id              INTEGER NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    duration_months     INTEGER NOT NULL CHECK (duration_months > 0),
    price_paise         INTEGER NOT NULL,
    admission_fee_paise INTEGER NOT NULL DEFAULT 0,
    tax_percentage      REAL NOT NULL DEFAULT 0,
    is_active           INTEGER NOT NULL DEFAULT 1,
    billing_period      TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (billing_period IN ('MONTHLY','YEARLY')),
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL,
    deleted_at          INTEGER,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX membership_plans_gym_id_unique   ON membership_plans(gym_id, id);
CREATE UNIQUE INDEX membership_plans_gym_name_unique ON membership_plans(gym_id, name);
CREATE INDEX idx_membership_plans_gym_active ON membership_plans(gym_id, is_active, deleted_at);

-- ============================================================================
-- 12. members — Gym customers
-- ============================================================================
CREATE TABLE members (
    id                        INTEGER PRIMARY KEY,
    gym_id                    INTEGER NOT NULL,
    member_code               TEXT NOT NULL,
    first_name                TEXT NOT NULL,
    last_name                 TEXT,
    email                     TEXT,
    phone                     TEXT NOT NULL,
    gender                    TEXT CHECK (gender IS NULL OR gender IN ('MALE','FEMALE','OTHER')),
    date_of_birth             INTEGER,
    photo_url                 TEXT,
    face_embedding            TEXT,
    biometric_consent_given   INTEGER NOT NULL DEFAULT 0,
    biometric_consent_at      INTEGER,
    biometric_consent_version TEXT DEFAULT '1.0',
    address                   TEXT,
    city                      TEXT,
    pincode                   TEXT,
    emergency_contact_name    TEXT,
    emergency_contact_phone   TEXT,
    health_notes              TEXT,
    status                    TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','BLOCKED','EXPIRED','FROZEN','CANCELLED')),
    joined_date               INTEGER NOT NULL,
    created_at                INTEGER NOT NULL,
    updated_at                INTEGER NOT NULL,
    deleted_at                INTEGER,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX members_gym_id_unique          ON members(gym_id, id);
CREATE UNIQUE INDEX members_gym_member_code_unique ON members(gym_id, member_code);
CREATE UNIQUE INDEX members_gym_phone_unique       ON members(gym_id, phone);
CREATE INDEX idx_members_gym_status ON members(gym_id, status, deleted_at);
CREATE INDEX idx_members_gym_name   ON members(gym_id, last_name, first_name);

-- ============================================================================
-- 13. memberships — Member subscriptions to plans
-- ============================================================================
CREATE TABLE memberships (
    id                  INTEGER PRIMARY KEY,
    gym_id              INTEGER NOT NULL,
    member_id           INTEGER NOT NULL,
    membership_plan_id  INTEGER NOT NULL,
    start_date          INTEGER NOT NULL,
    end_date            INTEGER NOT NULL,
    total_amount_paise  INTEGER NOT NULL,
    discount_paise      INTEGER NOT NULL DEFAULT 0,
    final_amount_paise  INTEGER NOT NULL,
    paid_amount_paise   INTEGER NOT NULL DEFAULT 0,
    due_amount_paise    INTEGER NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRED','FROZEN','CANCELLED')),
    frozen_at           INTEGER,
    notes               TEXT,
    created_by_user_id  INTEGER,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL,
    deleted_at          INTEGER,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, member_id)          REFERENCES members(gym_id, id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, membership_plan_id) REFERENCES membership_plans(gym_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX memberships_gym_id_unique ON memberships(gym_id, id);
CREATE INDEX idx_memberships_gym_member        ON memberships(gym_id, member_id);
CREATE INDEX idx_memberships_gym_status_dates  ON memberships(gym_id, status, end_date);
CREATE INDEX idx_memberships_gym_end_date      ON memberships(gym_id, end_date);

-- ============================================================================
-- 14. payments — Fee receipts & dues payments
-- ============================================================================
CREATE TABLE payments (
    id                  INTEGER PRIMARY KEY,
    gym_id              INTEGER NOT NULL,
    member_id           INTEGER NOT NULL,
    membership_id       INTEGER,
    payment_type        TEXT NOT NULL DEFAULT 'GYM' CHECK (payment_type IN ('GYM','PERSONAL_TRAINING')),
    receipt_number      TEXT NOT NULL,
    amount_paise        INTEGER NOT NULL,
    payment_date        INTEGER NOT NULL,
    payment_mode        TEXT NOT NULL CHECK (payment_mode IN ('CASH','UPI','CARD','BANK_TRANSFER','OTHER')),
    reference_id        TEXT,
    status              TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED','REFUNDED','VOID')),
    recorded_by_user_id INTEGER,
    notes               TEXT,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL,
    deleted_at          INTEGER,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, member_id)     REFERENCES members(gym_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (gym_id, membership_id) REFERENCES memberships(gym_id, id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX payments_gym_id_unique      ON payments(gym_id, id);
CREATE UNIQUE INDEX payments_gym_receipt_unique ON payments(gym_id, receipt_number);
CREATE INDEX idx_payments_gym_date        ON payments(gym_id, payment_date);
CREATE INDEX idx_payments_gym_member_date ON payments(gym_id, member_id, payment_date);
CREATE INDEX idx_payments_gym_status_date ON payments(gym_id, status, payment_date);

-- ============================================================================
-- 15. pt_collections — PT payments + trainer commissions
-- ============================================================================
CREATE TABLE pt_collections (
    id                     INTEGER PRIMARY KEY,
    gym_id                 INTEGER NOT NULL,
    member_id              INTEGER NOT NULL,
    trainer_id             INTEGER NOT NULL,
    sessions               INTEGER NOT NULL DEFAULT 0,
    amount_paise           INTEGER NOT NULL,
    commission_percentage  REAL NOT NULL DEFAULT 0,
    commission_paise       INTEGER NOT NULL DEFAULT 0,
    commission_status      TEXT NOT NULL DEFAULT 'PENDING' CHECK (commission_status IN ('PENDING','PAID')),
    payment_mode           TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_mode IN ('CASH','UPI','CARD','BANK_TRANSFER','OTHER')),
    payment_date           INTEGER NOT NULL,
    receipt_number         TEXT,
    notes                  TEXT,
    recorded_by_user_id    INTEGER,
    created_at             INTEGER NOT NULL,
    updated_at             INTEGER NOT NULL,
    deleted_at             INTEGER,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, member_id)  REFERENCES members(gym_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (gym_id, trainer_id) REFERENCES users(gym_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX pt_collections_gym_id_unique ON pt_collections(gym_id, id);
CREATE INDEX idx_pt_collections_gym_date    ON pt_collections(gym_id, payment_date);
CREATE INDEX idx_pt_collections_gym_trainer ON pt_collections(gym_id, trainer_id, commission_status);
CREATE UNIQUE INDEX pt_collections_gym_receipt_unique
  ON pt_collections(gym_id, receipt_number) WHERE receipt_number IS NOT NULL;

-- ============================================================================
-- 16. attendance — Floor check-ins
-- ============================================================================
CREATE TABLE attendance (
    id                  INTEGER PRIMARY KEY,
    gym_id              INTEGER NOT NULL,
    member_id           INTEGER NOT NULL,
    check_in_time       INTEGER NOT NULL,
    check_out_time      INTEGER,
    attendance_date     INTEGER NOT NULL,
    method              TEXT NOT NULL CHECK (method IN ('MANUAL','QR','FACE_ID','KIOSK')),
    recorded_by_user_id INTEGER,
    device_info         TEXT,
    created_at          INTEGER NOT NULL,
    deleted_at          INTEGER,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, member_id) REFERENCES members(gym_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX attendance_gym_id_unique    ON attendance(gym_id, id);
CREATE INDEX idx_attendance_gym_date        ON attendance(gym_id, attendance_date);
CREATE INDEX idx_attendance_gym_member_date ON attendance(gym_id, member_id, attendance_date);
CREATE INDEX idx_attendance_gym_checkin     ON attendance(gym_id, check_in_time);

-- ============================================================================
-- 17. communication_logs — SMS/WhatsApp/Email dispatch log
-- ============================================================================
CREATE TABLE communication_logs (
    id                 INTEGER PRIMARY KEY,
    gym_id             INTEGER NOT NULL,
    member_id          INTEGER,
    channel            TEXT NOT NULL CHECK (channel IN ('SMS','WHATSAPP','EMAIL')),
    recipient_phone    TEXT,
    recipient_name     TEXT,
    message_type       TEXT NOT NULL,
    credits_deducted   INTEGER NOT NULL DEFAULT 1,
    remaining_balance  INTEGER NOT NULL,
    lawful_basis       TEXT,
    retention_until    INTEGER,
    dispatched_by_id   INTEGER,
    ip                 TEXT,
    created_at         INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, member_id) REFERENCES members(gym_id, id)
);
CREATE UNIQUE INDEX communication_logs_gym_id_unique ON communication_logs(gym_id, id);
CREATE INDEX idx_comm_logs_gym    ON communication_logs(gym_id, created_at);
CREATE INDEX idx_comm_logs_member ON communication_logs(member_id);

-- ============================================================================
-- 18. menu_items — System navigation & features catalog
-- ============================================================================
CREATE TABLE menu_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    key          TEXT NOT NULL UNIQUE,
    label        TEXT NOT NULL,
    href         TEXT,
    icon         TEXT,
    group_key    TEXT NOT NULL DEFAULT 'main',
    "order"      INTEGER NOT NULL DEFAULT 10,
    feature_key  TEXT,
    admin_only   INTEGER NOT NULL DEFAULT 0,
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
);
CREATE INDEX idx_menu_items_group_order ON menu_items(group_key, "order");

-- Seed the complete 14-item navigation & feature catalog
INSERT INTO menu_items (id, key, label, href, icon, group_key, "order", feature_key, admin_only, is_active, created_at, updated_at) VALUES
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
-- 19. role_menus — Junction table (gym role -> menu item)
-- ============================================================================
CREATE TABLE role_menus (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id       INTEGER NOT NULL,
    role_id      INTEGER NOT NULL,
    menu_item_id INTEGER NOT NULL,
    created_at   INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX role_menus_role_menu_unique ON role_menus(gym_id, role_id, menu_item_id);
CREATE INDEX idx_role_menus_gym_role ON role_menus(gym_id, role_id);
CREATE INDEX idx_role_menus_gym_menu ON role_menus(gym_id, menu_item_id);

-- ============================================================================
-- 20. classes — Group fitness offerings
-- ============================================================================
CREATE TABLE classes (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id            INTEGER NOT NULL,
    name              TEXT NOT NULL,
    description       TEXT,
    duration_minutes  INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
    max_capacity      INTEGER NOT NULL DEFAULT 20 CHECK (max_capacity > 0),
    color             TEXT NOT NULL DEFAULT '#4f46e5',
    is_active         INTEGER NOT NULL DEFAULT 1,
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX classes_gym_id_unique ON classes(gym_id, id);
CREATE INDEX idx_classes_gym_name ON classes(gym_id, name);

-- ============================================================================
-- 21. class_schedules — Weekly timetables & one-off classes
-- ============================================================================
CREATE TABLE class_schedules (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id           INTEGER NOT NULL,
    class_id         INTEGER NOT NULL,
    trainer_user_id  INTEGER,
    day_of_week      INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time       TEXT NOT NULL,
    end_time         TEXT NOT NULL,
    date             TEXT,
    max_capacity     INTEGER NOT NULL DEFAULT 20 CHECK (max_capacity > 0),
    is_cancelled     INTEGER NOT NULL DEFAULT 0,
    created_at       INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, class_id)        REFERENCES classes(gym_id, id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, trainer_user_id) REFERENCES users(gym_id, id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX class_schedules_gym_id_unique ON class_schedules(gym_id, id);
CREATE INDEX idx_class_schedules_gym_class   ON class_schedules(gym_id, class_id);
CREATE INDEX idx_class_schedules_gym_day     ON class_schedules(gym_id, day_of_week);
CREATE INDEX idx_class_schedules_gym_trainer ON class_schedules(gym_id, trainer_user_id);

-- ============================================================================
-- 22. class_bookings — Member reservations for scheduled classes
-- ============================================================================
CREATE TABLE class_bookings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id        INTEGER NOT NULL,
    schedule_id   INTEGER NOT NULL,
    member_id     INTEGER NOT NULL,
    status        TEXT NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED','ATTENDED','CANCELLED','NO_SHOW','WAITLIST')),
    booked_at     INTEGER NOT NULL,
    attended_at   INTEGER,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, schedule_id) REFERENCES class_schedules(gym_id, id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, member_id)   REFERENCES members(gym_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX class_bookings_gym_id_unique ON class_bookings(gym_id, id);
CREATE INDEX idx_class_bookings_gym_schedule ON class_bookings(gym_id, schedule_id);
CREATE INDEX idx_class_bookings_gym_member   ON class_bookings(gym_id, member_id);

-- ============================================================================
-- 23. pt_packages — Personal training package agreements
-- ============================================================================
CREATE TABLE pt_packages (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id              INTEGER NOT NULL,
    member_id           INTEGER NOT NULL,
    trainer_user_id     INTEGER NOT NULL,
    package_name        TEXT NOT NULL DEFAULT 'Personal Training',
    total_sessions      INTEGER NOT NULL CHECK (total_sessions > 0),
    completed_sessions  INTEGER NOT NULL DEFAULT 0 CHECK (completed_sessions >= 0),
    price_paise         INTEGER NOT NULL CHECK (price_paise >= 0),
    start_date          TEXT NOT NULL,
    expiry_date         TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','COMPLETED','EXPIRED')),
    notes               TEXT,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, member_id)       REFERENCES members(gym_id, id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, trainer_user_id) REFERENCES users(gym_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX pt_packages_gym_id_unique ON pt_packages(gym_id, id);
CREATE INDEX idx_pt_packages_gym_member  ON pt_packages(gym_id, member_id);
CREATE INDEX idx_pt_packages_gym_trainer ON pt_packages(gym_id, trainer_user_id);

-- ============================================================================
-- 24. pt_sessions — Individual workout logs against a PT package
-- ============================================================================
CREATE TABLE pt_sessions (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id                INTEGER NOT NULL,
    package_id            INTEGER NOT NULL,
    session_number        INTEGER NOT NULL CHECK (session_number > 0),
    session_date          TEXT NOT NULL,
    notes                 TEXT,
    trainer_user_id       INTEGER NOT NULL,
    signed_off_by_member  INTEGER NOT NULL DEFAULT 1,
    created_at            INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, package_id)      REFERENCES pt_packages(gym_id, id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, trainer_user_id) REFERENCES users(gym_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX pt_sessions_gym_id_unique ON pt_sessions(gym_id, id);
CREATE INDEX idx_pt_sessions_gym_package ON pt_sessions(gym_id, package_id);

-- ============================================================================
-- 25. products — POS retail & supplement inventory
-- ============================================================================
CREATE TABLE products (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id               INTEGER NOT NULL,
    name                 TEXT NOT NULL,
    sku                  TEXT,
    category             TEXT NOT NULL DEFAULT 'General',
    price_paise          INTEGER NOT NULL CHECK (price_paise >= 0),
    cost_paise           INTEGER NOT NULL DEFAULT 0 CHECK (cost_paise >= 0),
    stock_quantity       INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    low_stock_threshold  INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
    tax_rate             REAL NOT NULL DEFAULT 0,
    is_active            INTEGER NOT NULL DEFAULT 1,
    created_at           INTEGER NOT NULL,
    updated_at           INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX products_gym_id_unique ON products(gym_id, id);
CREATE INDEX idx_products_gym_name ON products(gym_id, name);

-- ============================================================================
-- 26. pos_sales — Point of sale orders
-- ============================================================================
CREATE TABLE pos_sales (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id          INTEGER NOT NULL,
    receipt_number  TEXT NOT NULL,
    member_id       INTEGER,
    subtotal_paise  INTEGER NOT NULL CHECK (subtotal_paise >= 0),
    tax_paise       INTEGER NOT NULL DEFAULT 0 CHECK (tax_paise >= 0),
    total_paise     INTEGER NOT NULL CHECK (total_paise >= 0),
    payment_mode    TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_mode IN ('CASH','UPI','CARD','BANK_TRANSFER','OTHER')),
    notes           TEXT,
    created_at      INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, member_id) REFERENCES members(gym_id, id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX pos_sales_gym_id_unique      ON pos_sales(gym_id, id);
CREATE UNIQUE INDEX pos_sales_gym_receipt_unique ON pos_sales(gym_id, receipt_number);
CREATE INDEX idx_pos_sales_gym_member ON pos_sales(gym_id, member_id);

-- ============================================================================
-- 27. pos_sale_items — Line items in a POS sale
-- ============================================================================
CREATE TABLE pos_sale_items (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id            INTEGER NOT NULL,
    sale_id           INTEGER NOT NULL,
    product_id        INTEGER NOT NULL,
    quantity          INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_paise  INTEGER NOT NULL CHECK (unit_price_paise >= 0),
    total_paise       INTEGER NOT NULL CHECK (total_paise >= 0),
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, sale_id)    REFERENCES pos_sales(gym_id, id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, product_id) REFERENCES products(gym_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX pos_sale_items_gym_id_unique ON pos_sale_items(gym_id, id);
CREATE INDEX idx_pos_sale_items_gym_sale ON pos_sale_items(gym_id, sale_id);

-- ============================================================================
-- 28. expense_categories — Gym expenditure categories
-- ============================================================================
CREATE TABLE expense_categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id      INTEGER NOT NULL,
    name        TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX expense_categories_gym_id_unique   ON expense_categories(gym_id, id);
CREATE UNIQUE INDEX expense_categories_gym_name_unique ON expense_categories(gym_id, name);

-- ============================================================================
-- 29. expenses — Gym expenses (for P&L)
-- ============================================================================
CREATE TABLE expenses (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id              INTEGER NOT NULL,
    category_id         INTEGER NOT NULL,
    title               TEXT NOT NULL,
    amount_paise        INTEGER NOT NULL CHECK (amount_paise >= 0),
    expense_date        TEXT NOT NULL,
    payment_mode        TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_mode IN ('CASH','UPI','CARD','BANK_TRANSFER','OTHER')),
    vendor              TEXT,
    receipt_url         TEXT,
    created_by_user_id  INTEGER,
    created_at          INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, category_id)        REFERENCES expense_categories(gym_id, id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, created_by_user_id) REFERENCES users(gym_id, id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX expenses_gym_id_unique ON expenses(gym_id, id);
CREATE INDEX idx_expenses_gym_date     ON expenses(gym_id, expense_date);
CREATE INDEX idx_expenses_gym_category ON expenses(gym_id, category_id);

-- ============================================================================
-- 30. lockers — Physical lockers
-- ============================================================================
CREATE TABLE lockers (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id         INTEGER NOT NULL,
    locker_number  TEXT NOT NULL,
    zone           TEXT,
    status         TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','OCCUPIED','MAINTENANCE')),
    created_at     INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX lockers_gym_id_unique     ON lockers(gym_id, id);
CREATE UNIQUE INDEX lockers_gym_number_unique ON lockers(gym_id, locker_number);

-- ============================================================================
-- 31. locker_allocations — Locker rentals to members
-- ============================================================================
CREATE TABLE locker_allocations (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id         INTEGER NOT NULL,
    locker_id      INTEGER NOT NULL,
    member_id      INTEGER NOT NULL,
    start_date     TEXT NOT NULL,
    end_date       TEXT NOT NULL,
    deposit_paise  INTEGER NOT NULL DEFAULT 0 CHECK (deposit_paise >= 0),
    rent_paise     INTEGER NOT NULL DEFAULT 0 CHECK (rent_paise >= 0),
    status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','TERMINATED','OVERDUE')),
    created_at     INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, locker_id) REFERENCES lockers(gym_id, id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, member_id) REFERENCES members(gym_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX locker_allocations_gym_id_unique ON locker_allocations(gym_id, id);
CREATE INDEX idx_locker_allocations_gym_locker ON locker_allocations(gym_id, locker_id);
CREATE INDEX idx_locker_allocations_gym_member ON locker_allocations(gym_id, member_id);
