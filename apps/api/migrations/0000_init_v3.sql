-- ============================================================================
-- GYM SAAS D1 MIGRATION 0000 — Multi-tenant v3 schema
-- ============================================================================
-- Single consolidated migration. Replaces the old 0000/0001/0002 files.
--
-- Tenancy model:
--   - One database, many gyms. gym_id is the tenant isolation key.
--   - gym-owned tables have gym_id and use composite foreign keys so the
--     database engine itself rejects cross-tenant inserts.
--   - Tenant-aware uniques: UNIQUE(gym_id, <col>) instead of global.
--   - Numeric primary keys. TEXT enums (legends live in shared/constants.ts).
--   - All money in integer paise. All timestamps in unixepoch seconds.
--   - DATE helpers (e.g. attendance_date) stored as YYYYMMDD integers for
--     fast equality lookups without date functions.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. platform_admins  (SUPER_ADMIN login identities; no gym_id)
-- ============================================================================
CREATE TABLE IF NOT EXISTS platform_admins (
    id              INTEGER PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    name            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    last_login_at   INTEGER,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    deleted_at      INTEGER
);

-- ============================================================================
-- 2. gyms  (tenant root)
-- ============================================================================
CREATE TABLE IF NOT EXISTS gyms (
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    phone           TEXT NOT NULL,
    email           TEXT,
    address         TEXT,
    city            TEXT,
    state           TEXT,
    pincode         TEXT,
    gst_number      TEXT,
    currency        TEXT NOT NULL DEFAULT 'INR',
    logo_url        TEXT,
    status          TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','CANCELLED')),
    notification_settings_json TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    deleted_at      INTEGER
);

CREATE INDEX IF NOT EXISTS idx_gyms_status ON gyms(status, deleted_at);

-- ============================================================================
-- 3. licenses  (one per gym; plan metadata lives here directly)
--    No separate saas_plans table — each gym's plan is a self-contained row.
-- ============================================================================
CREATE TABLE IF NOT EXISTS licenses (
    id                INTEGER PRIMARY KEY,
    gym_id            INTEGER NOT NULL UNIQUE,
    name              TEXT NOT NULL,                   -- "Professional"
    code              TEXT NOT NULL,                   -- "PRO"
    price_paise       INTEGER NOT NULL,                -- what this gym pays
    billing_period    TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (billing_period IN ('MONTHLY','YEARLY')),
    max_members       INTEGER NOT NULL,                -- -1 = unlimited
    max_owners        INTEGER NOT NULL DEFAULT 1,
    max_managers      INTEGER NOT NULL,
    max_staff_total   INTEGER NOT NULL,
    max_sms           INTEGER NOT NULL,
    max_whatsapp      INTEGER NOT NULL,
    max_email         INTEGER NOT NULL,
    sms_used          INTEGER NOT NULL DEFAULT 0,
    whatsapp_used     INTEGER NOT NULL DEFAULT 0,
    email_used        INTEGER NOT NULL DEFAULT 0,
    features          TEXT NOT NULL DEFAULT '{}',
    started_at        INTEGER NOT NULL,
    expires_at        INTEGER NOT NULL,
    status            TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRED','SUSPENDED')),
    created_by_admin_id INTEGER,
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);

-- ============================================================================
-- 4. users  (gym staff: OWNER / MANAGER / STAFF / TRAINER)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id                  INTEGER PRIMARY KEY,
    gym_id              INTEGER NOT NULL,
    name                TEXT NOT NULL,
    email               TEXT NOT NULL,
    phone               TEXT,
    password_hash       TEXT NOT NULL,
    role                TEXT NOT NULL CHECK (role IN ('OWNER','MANAGER','STAFF','TRAINER','MEMBER')),
    status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    permissions         TEXT NOT NULL DEFAULT '{}',
    last_login_at       INTEGER,
    failed_login_count  INTEGER NOT NULL DEFAULT 0,
    locked_until        INTEGER,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL,
    deleted_at          INTEGER,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    UNIQUE (gym_id, id),     -- composite FK target for tenant-aware child tables
    UNIQUE (gym_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_gym_role ON users(gym_id, role);
CREATE INDEX IF NOT EXISTS idx_users_gym_status ON users(gym_id, status, deleted_at);

-- ============================================================================
-- 5. gym_settings  (per-gym JSON config blob)
-- ============================================================================
CREATE TABLE IF NOT EXISTS gym_settings (
    gym_id          INTEGER PRIMARY KEY,
    settings        TEXT NOT NULL DEFAULT '{}',
    updated_by_user_id INTEGER,
    updated_at      INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);

-- ============================================================================
-- 6. membership_plans  (gym-level catalog; sold to members)
-- ============================================================================
CREATE TABLE IF NOT EXISTS membership_plans (
    id                INTEGER PRIMARY KEY,
    gym_id            INTEGER NOT NULL,
    name              TEXT NOT NULL,
    description       TEXT,
    duration_months   INTEGER NOT NULL,
    price_paise       INTEGER NOT NULL,
    admission_fee_paise INTEGER NOT NULL DEFAULT 0,
    tax_percentage    REAL NOT NULL DEFAULT 0,
    is_active         INTEGER NOT NULL DEFAULT 1,
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL,
    deleted_at        INTEGER,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    UNIQUE (gym_id, id),     -- composite FK target for memberships
    UNIQUE (gym_id, name)
);

CREATE INDEX IF NOT EXISTS idx_membership_plans_gym_active
    ON membership_plans(gym_id, is_active, deleted_at);

-- ============================================================================
-- 7. members  (gym customers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS members (
    id                       INTEGER PRIMARY KEY,
    gym_id                   INTEGER NOT NULL,
    member_code              TEXT NOT NULL,
    first_name               TEXT NOT NULL,
    last_name                TEXT,
    email                    TEXT,
    phone                    TEXT NOT NULL,
    gender                   TEXT CHECK (gender IS NULL OR gender IN ('MALE','FEMALE','OTHER')),
    date_of_birth            INTEGER,                    -- unix seconds
    photo_url                TEXT,
    face_embedding           TEXT,
    address                  TEXT,
    city                     TEXT,
    pincode                  TEXT,
    emergency_contact_name   TEXT,
    emergency_contact_phone  TEXT,
    health_notes             TEXT,
    status                   TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','BLOCKED','EXPIRED','FROZEN')),
    joined_date              INTEGER NOT NULL,
    created_at               INTEGER NOT NULL,
    updated_at               INTEGER NOT NULL,
    deleted_at               INTEGER,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    UNIQUE (gym_id, id),     -- composite FK target for tenant-aware child tables
    UNIQUE (gym_id, member_code),
    UNIQUE (gym_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_members_gym_status
    ON members(gym_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_members_gym_name
    ON members(gym_id, last_name, first_name);

-- ============================================================================
-- 8. memberships  (member ↔ plan instance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS memberships (
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
    -- Composite FKs enforce same-gym invariant at the DB level
    FOREIGN KEY (gym_id, member_id) REFERENCES members(gym_id, id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, membership_plan_id) REFERENCES membership_plans(gym_id, id) ON DELETE RESTRICT
);

-- `memberships` is also referenced by payments/pt_collections as a composite FK,
-- so it needs its own (gym_id, id) uniqueness invariant.
CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_gym_id ON memberships(gym_id, id);

CREATE INDEX IF NOT EXISTS idx_memberships_gym_member ON memberships(gym_id, member_id);
CREATE INDEX IF NOT EXISTS idx_memberships_gym_status_dates ON memberships(gym_id, status, end_date);
CREATE INDEX IF NOT EXISTS idx_memberships_gym_end_date ON memberships(gym_id, end_date);

-- ============================================================================
-- 9. payments  (GYM type money collection)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id                    INTEGER PRIMARY KEY,
    gym_id                INTEGER NOT NULL,
    member_id             INTEGER NOT NULL,
    membership_id         INTEGER,
    payment_type          TEXT NOT NULL DEFAULT 'GYM' CHECK (payment_type IN ('GYM','PERSONAL_TRAINING')),
    receipt_number        TEXT NOT NULL,
    amount_paise          INTEGER NOT NULL,
    payment_date          INTEGER NOT NULL,
    payment_mode          TEXT NOT NULL CHECK (payment_mode IN ('CASH','UPI','CARD','BANK_TRANSFER','OTHER')),
    reference_id          TEXT,
    status                TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED','REFUNDED','VOID')),
    recorded_by_user_id  INTEGER,
    notes                 TEXT,
    created_at            INTEGER NOT NULL,
    updated_at            INTEGER NOT NULL,
    deleted_at            INTEGER,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, member_id) REFERENCES members(gym_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (gym_id, membership_id) REFERENCES memberships(gym_id, id) ON DELETE SET NULL,
    UNIQUE (gym_id, receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_payments_gym_date ON payments(gym_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_gym_member_date ON payments(gym_id, member_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_gym_status_date ON payments(gym_id, status, payment_date);

-- ============================================================================
-- 10. pt_collections  (PERSONAL_TRAINING payments + commission splits)
-- ============================================================================
CREATE TABLE IF NOT EXISTS pt_collections (
    id                    INTEGER PRIMARY KEY,
    gym_id                INTEGER NOT NULL,
    member_id             INTEGER NOT NULL,
    trainer_id            INTEGER NOT NULL,
    sessions              INTEGER NOT NULL DEFAULT 0,
    amount_paise          INTEGER NOT NULL,
    commission_percentage REAL NOT NULL DEFAULT 0,
    commission_paise      INTEGER NOT NULL DEFAULT 0,
    commission_status     TEXT NOT NULL DEFAULT 'PENDING' CHECK (commission_status IN ('PENDING','PAID')),
    payment_mode          TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_mode IN ('CASH','UPI','CARD','BANK_TRANSFER','OTHER')),
    payment_date          INTEGER NOT NULL,
    receipt_number        TEXT,
    notes                 TEXT,
    recorded_by_user_id  INTEGER,
    created_at            INTEGER NOT NULL,
    updated_at            INTEGER NOT NULL,
    deleted_at            INTEGER,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, member_id) REFERENCES members(gym_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (gym_id, trainer_id) REFERENCES users(gym_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_pt_collections_gym_date ON pt_collections(gym_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_pt_collections_gym_trainer ON pt_collections(gym_id, trainer_id, commission_status);

-- ============================================================================
-- 11. attendance
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance (
    id                    INTEGER PRIMARY KEY,
    gym_id                INTEGER NOT NULL,
    member_id             INTEGER NOT NULL,
    check_in_time         INTEGER NOT NULL,
    check_out_time        INTEGER,
    attendance_date       INTEGER NOT NULL,             -- YYYYMMDD for fast day-equality
    method                TEXT NOT NULL CHECK (method IN ('MANUAL','QR','FACE_ID')),
    recorded_by_user_id   INTEGER,
    device_info           TEXT,
    created_at            INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id, member_id) REFERENCES members(gym_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attendance_gym_date ON attendance(gym_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_gym_member_date ON attendance(gym_id, member_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_gym_checkin ON attendance(gym_id, check_in_time);

-- ============================================================================
-- 12. user_sessions  (server-side session records)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id          INTEGER PRIMARY KEY,
    gym_id      INTEGER NOT NULL,
    user_id     INTEGER NOT NULL,
    token_hash  TEXT NOT NULL UNIQUE,
    ip          TEXT,
    user_agent  TEXT,
    issued_at   INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL,
    revoked_at  INTEGER,
    FOREIGN KEY (gym_id, user_id) REFERENCES users(gym_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_gym_user ON user_sessions(gym_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- ============================================================================
-- 13. user_password_resets
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_password_resets (
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
-- 14. audit_events  (gym-scoped audit log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_events (
    id            INTEGER PRIMARY KEY,
    gym_id        INTEGER NOT NULL,
    actor_user_id INTEGER,
    actor_role    TEXT,
    action        TEXT NOT NULL,                       -- e.g. 'member.create'
    entity_type   TEXT NOT NULL,                       -- e.g. 'member'
    entity_id     INTEGER,
    before_state  TEXT,
    after_state   TEXT,
    ip            TEXT,
    user_agent    TEXT,
    device_info   TEXT,
    metadata      TEXT,
    created_at    INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_gym_created ON audit_events(gym_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_gym_action_created ON audit_events(gym_id, action, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_gym_entity ON audit_events(gym_id, entity_type, entity_id);

-- ============================================================================
-- 15. saas_audit_events  (platform-level audit log; no gym_id)
-- ============================================================================
CREATE TABLE IF NOT EXISTS saas_audit_events (
    id                INTEGER PRIMARY KEY,
    actor_admin_id    INTEGER NOT NULL,
    affected_gym_id   INTEGER,
    action            TEXT NOT NULL,
    entity_type       TEXT,
    entity_id         INTEGER,
    before_state      TEXT,
    after_state       TEXT,
    ip                TEXT,
    user_agent        TEXT,
    metadata          TEXT,
    created_at        INTEGER NOT NULL,
    FOREIGN KEY (actor_admin_id) REFERENCES platform_admins(id)
);

CREATE INDEX IF NOT EXISTS idx_saas_audit_admin_created ON saas_audit_events(actor_admin_id, created_at);
CREATE INDEX IF NOT EXISTS idx_saas_audit_gym_created ON saas_audit_events(affected_gym_id, created_at);

-- ============================================================================
-- 16. platform_settings  (Super Admin global gateway configs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS platform_settings (
    key         TEXT PRIMARY KEY,
    value_json  TEXT NOT NULL,
    updated_at  INTEGER NOT NULL
);

-- ============================================================================
-- 17. gym_features  (Super Admin per-gym feature permissions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS gym_features (
    gym_id      INTEGER NOT NULL,
    feature_key TEXT NOT NULL,
    is_enabled  INTEGER NOT NULL DEFAULT 1,
    updated_at  INTEGER NOT NULL,
    PRIMARY KEY (gym_id, feature_key),
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gym_features_lookup ON gym_features(gym_id, is_enabled);

-- ============================================================================
-- 18. communication_logs  (Granular quota consumption audit)
-- ============================================================================
CREATE TABLE IF NOT EXISTS communication_logs (
    id                INTEGER PRIMARY KEY,
    gym_id            INTEGER NOT NULL,
    channel           TEXT NOT NULL CHECK (channel IN ('SMS','WHATSAPP','EMAIL')),
    recipient_phone   TEXT,
    recipient_name    TEXT,
    message_type      TEXT NOT NULL,
    credits_deducted  INTEGER NOT NULL DEFAULT 1,
    remaining_balance INTEGER NOT NULL,
    dispatched_by_id  INTEGER,
    ip                TEXT,
    created_at        INTEGER NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comm_logs_gym ON communication_logs(gym_id, created_at);

-- ============================================================================
-- Seed: bootstrap a single SUPER_ADMIN and a single starter gym so the app
-- boots for the very first run. The seed is idempotent and uses fixed ids.
-- ============================================================================
INSERT OR IGNORE INTO platform_admins (id, email, password_hash, name, status, created_at, updated_at)
VALUES (1, 'admin@gymtech.app', '__SET_VIA_ENV__', 'Platform Admin', 'ACTIVE', unixepoch(), unixepoch());

INSERT OR IGNORE INTO gyms (id, name, slug, phone, status, created_at, updated_at)
VALUES (1, 'GymTech Demo Gym', 'demo', '9999999999', 'ACTIVE', unixepoch(), unixepoch());

INSERT OR IGNORE INTO licenses (
    id, gym_id, name, code, price_paise, billing_period,
    max_members, max_owners, max_managers, max_staff_total,
    max_sms, max_whatsapp, max_email, started_at, expires_at, status,
    created_at, updated_at
) VALUES (
    1, 1, 'Demo', 'DEMO', 0, 'MONTHLY',
    1000, 1, 5, 10, 0, 0, 0, unixepoch(), unixepoch() + 31536000, 'ACTIVE',
    unixepoch(), unixepoch()
);

INSERT OR IGNORE INTO gym_features (gym_id, feature_key, is_enabled, updated_at)
SELECT 1, key, 1, unixepoch()
FROM (
    SELECT 'dashboard' as key
    UNION SELECT 'members'
    UNION SELECT 'attendance'
    UNION SELECT 'payments'
    UNION SELECT 'pt_collections'
    UNION SELECT 'plans'
    UNION SELECT 'staff'
    UNION SELECT 'reports'
    UNION SELECT 'settings'
);

