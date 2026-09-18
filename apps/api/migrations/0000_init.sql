-- ============================================================================
-- GymTech — consolidated baseline schema
-- ============================================================================
-- This single migration replaces the previous 0000–0010 incremental history.
-- It describes ONLY the 17 tables that the application actually uses; tables
-- that were never wired to a route, service, or repository were removed.
--
-- Conventions (enforced below):
--   * Money is stored as INTEGER paise (₹1 = 100 paise).
--   * All timestamps are unix seconds (INTEGER); attendance_date is YYYYMMDD.
--   * Every tenant-owned table carries gym_id.
--   * Parents referenced by a composite (gym_id, id) FK MUST expose a UNIQUE
--     index over those exact columns, otherwise SQLite raises
--     "foreign key mismatch" and every write to the child table fails.
--
-- Table order follows FK dependency order so the file can be applied to an
-- empty database in a single pass.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. platform_admins — platform operators (NOT tenant users)
-- ============================================================================
CREATE TABLE platform_admins (
    id                       INTEGER PRIMARY KEY,
    email                    TEXT NOT NULL UNIQUE,
    password_hash            TEXT NOT NULL,
    name                     TEXT NOT NULL,
    status                   TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    failed_login_count       INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
    locked_until             INTEGER,
    last_login_at            INTEGER,
    -- JSON array of gym IDs this admin may access; NULL/empty = full access.
    authorized_gyms          TEXT,
    created_at               INTEGER NOT NULL,
    updated_at               INTEGER NOT NULL,
    deleted_at               INTEGER
);

-- ============================================================================
-- 2. gyms — tenants
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
-- 3. licenses — one commercial license per gym (quotas + feature flags)
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
    -- Authoritative feature-flag store: {"reports": true, "pt_collections": true}
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
-- 4. roles — owner-defined, per-gym; permissions are role-scoped
-- ============================================================================
CREATE TABLE roles (
    id           INTEGER PRIMARY KEY,
    gym_id       INTEGER NOT NULL,
    name         TEXT NOT NULL,
    -- JSON array of permission keys, e.g. ["members","payments"]
    permissions  TEXT NOT NULL DEFAULT '[]',
    -- True for the gym's primary owner role — grants unrestricted gym access.
    is_owner     INTEGER NOT NULL DEFAULT 0,
    is_default   INTEGER NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    deleted_at   INTEGER,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);
-- Partial unique index: a soft-deleted role's name can be reused.
CREATE UNIQUE INDEX roles_gym_name_unique ON roles(gym_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_roles_gym ON roles(gym_id, deleted_at);

-- ============================================================================
-- 5. users — gym staff/owners (platform admins live in platform_admins)
-- ============================================================================
CREATE TABLE users (
    id                  INTEGER PRIMARY KEY,
    gym_id              INTEGER NOT NULL,
    name                TEXT NOT NULL,
    email               TEXT NOT NULL,
    phone               TEXT,
    password_hash       TEXT NOT NULL,
    -- The ONLY role reference. There is no denormalized role-name column:
    -- a TEXT copy could not represent custom role names (its CHECK constraint
    -- rejected them) and would silently drift from the role it mirrored.
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
-- Parent key for every (gym_id, user_id) composite FK below.
CREATE UNIQUE INDEX users_gym_id_unique ON users(gym_id, id);
CREATE UNIQUE INDEX users_gym_email_unique ON users(gym_id, email);
CREATE INDEX idx_users_gym_owner  ON users(gym_id, is_owner);
CREATE INDEX idx_users_gym_status ON users(gym_id, status, deleted_at);
CREATE INDEX idx_users_gym_role   ON users(gym_id, role_id);

-- ============================================================================
-- 6. membership_plans — gym-level catalog sold to members
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
-- Parent key for memberships(gym_id, membership_plan_id) — REQUIRED.
CREATE UNIQUE INDEX membership_plans_gym_id_unique ON membership_plans(gym_id, id);
CREATE UNIQUE INDEX membership_plans_gym_name_unique ON membership_plans(gym_id, name);
CREATE INDEX idx_membership_plans_gym_active ON membership_plans(gym_id, is_active, deleted_at);

-- ============================================================================
-- 7. members — gym customers
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
-- Parent key for every (gym_id, member_id) composite FK below.
CREATE UNIQUE INDEX members_gym_id_unique ON members(gym_id, id);
CREATE UNIQUE INDEX members_gym_member_code_unique ON members(gym_id, member_code);
CREATE UNIQUE INDEX members_gym_phone_unique ON members(gym_id, phone);
CREATE INDEX idx_members_gym_status ON members(gym_id, status, deleted_at);
CREATE INDEX idx_members_gym_name   ON members(gym_id, last_name, first_name);

-- ============================================================================
-- 8. memberships — a member's instance of a plan
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
-- Parent key for payments(gym_id, membership_id) — REQUIRED.
CREATE UNIQUE INDEX memberships_gym_id_unique ON memberships(gym_id, id);
CREATE INDEX idx_memberships_gym_member        ON memberships(gym_id, member_id);
CREATE INDEX idx_memberships_gym_status_dates  ON memberships(gym_id, status, end_date);
CREATE INDEX idx_memberships_gym_end_date      ON memberships(gym_id, end_date);

-- ============================================================================
-- 9. payments — fee receipts
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
CREATE UNIQUE INDEX payments_gym_receipt_unique ON payments(gym_id, receipt_number);
CREATE INDEX idx_payments_gym_date           ON payments(gym_id, payment_date);
CREATE INDEX idx_payments_gym_member_date    ON payments(gym_id, member_id, payment_date);
CREATE INDEX idx_payments_gym_status_date    ON payments(gym_id, status, payment_date);

-- ============================================================================
-- 10. pt_collections — personal-training sessions + trainer commission
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
CREATE INDEX idx_pt_collections_gym_date    ON pt_collections(gym_id, payment_date);
CREATE INDEX idx_pt_collections_gym_trainer ON pt_collections(gym_id, trainer_id, commission_status);
-- PT receipts are optional, so the uniqueness constraint is partial: two rows
-- may both have NULL, but a given receipt number cannot repeat within a gym.
CREATE UNIQUE INDEX pt_collections_gym_receipt_unique
  ON pt_collections(gym_id, receipt_number) WHERE receipt_number IS NOT NULL;

-- ============================================================================
-- 11. attendance — floor check-ins (soft-deletable)
-- ============================================================================
CREATE TABLE attendance (
    id                  INTEGER PRIMARY KEY,
    gym_id              INTEGER NOT NULL,
    member_id           INTEGER NOT NULL,
    check_in_time       INTEGER NOT NULL,
    check_out_time      INTEGER,
    -- YYYYMMDD: enables day-range scans without time arithmetic.
    attendance_date     INTEGER NOT NULL,
    method              TEXT NOT NULL CHECK (method IN ('MANUAL','QR','FACE_ID')),
    recorded_by_user_id INTEGER,
    device_info         TEXT,
    created_at          INTEGER NOT NULL,
    deleted_at          INTEGER,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, member_id) REFERENCES members(gym_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_attendance_gym_date        ON attendance(gym_id, attendance_date);
CREATE INDEX idx_attendance_gym_member_date ON attendance(gym_id, member_id, attendance_date);
CREATE INDEX idx_attendance_gym_checkin     ON attendance(gym_id, check_in_time);

-- ============================================================================
-- 12. user_sessions — access + refresh token registry
-- ============================================================================
CREATE TABLE user_sessions (
    id                        INTEGER PRIMARY KEY,
    -- Platform-admin sessions are stored with gym_id = 0 (no tenant).
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
-- 13. user_password_resets
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
-- 14. audit_events — append-only trail (platform actions use gym_id = 0)
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
-- 15. counters — atomic sequences (receipt numbers, member codes)
-- ============================================================================
CREATE TABLE counters (
    gym_id        INTEGER NOT NULL,
    -- 'member_code' (lifetime per gym) | 'receipt:<YYYY>' (per calendar year)
    counter_type  TEXT NOT NULL,
    value         INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (gym_id, counter_type),
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);

-- ============================================================================
-- 16. platform_settings — global key/value config (gateways, SMTP, …)
-- ============================================================================
CREATE TABLE platform_settings (
    key         TEXT PRIMARY KEY,
    value_json  TEXT NOT NULL,
    updated_at  INTEGER NOT NULL
);

-- ============================================================================
-- 17. communication_logs — per-message credit consumption + GDPR basis
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
    -- Gym-scoped so a log row can never reference another tenant's member.
    -- A NULL member_id (gym-wide broadcast) still satisfies the constraint.
    FOREIGN KEY (gym_id, member_id) REFERENCES members(gym_id, id)
);
CREATE INDEX idx_comm_logs_gym    ON communication_logs(gym_id, created_at);
CREATE INDEX idx_comm_logs_member ON communication_logs(member_id);

-- ============================================================================
-- 18. menu_items — database catalog of system routes & pages
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

-- Seed the core menu catalog
INSERT INTO menu_items (key, label, href, icon, group_key, "order", feature_key, admin_only, is_active, created_at, updated_at) VALUES
  ('dashboard', 'Dashboard', '/dashboard', 'LayoutDashboard', 'main', 10, null, 0, 1, unixepoch(), unixepoch()),
  ('members', 'Members Directory', '/members', 'Users', 'main', 20, 'members', 0, 1, unixepoch(), unixepoch()),
  ('attendance', 'Floor & Attendance', '/attendance', 'CalendarCheck', 'main', 30, 'attendance', 0, 1, unixepoch(), unixepoch()),
  ('payments', 'Payments & Billing', '/payments', 'CreditCard', 'main', 40, 'payments', 0, 1, unixepoch(), unixepoch()),
  ('pt_collections', 'PT Collections', '/pt-collections', 'Trophy', 'main', 50, 'pt_collections', 0, 1, unixepoch(), unixepoch()),
  ('plans', 'Membership Plans', '/plans', 'Tag', 'main', 60, 'plans', 0, 1, unixepoch(), unixepoch()),
  ('reports', 'Financial Reports', '/reports', 'BarChart3', 'main', 70, 'reports', 0, 1, unixepoch(), unixepoch()),
  ('staff', 'Staff Management', '/staff', 'UserCog', 'admin', 80, 'staff', 0, 1, unixepoch(), unixepoch()),
  ('settings', 'Gym Settings', '/settings', 'Settings', 'admin', 90, 'settings', 0, 1, unixepoch(), unixepoch()),
  ('audit_logs', 'Audit Logs', '/audit-logs', 'Sliders', 'admin', 100, 'audit_logs', 0, 1, unixepoch(), unixepoch());

-- ============================================================================
-- 19. role_menus — junction table (gym role -> menu access)
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
