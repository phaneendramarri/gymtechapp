-- Migration 0003: Add gym_features and communication_logs tables
-- ============================================================================
-- 1. gym_features (per-gym dynamic feature access gating)
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
-- 2. communication_logs (granular tracking of every SMS, WA, and Email consumption)
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
-- 3. Backfill default active features for existing gyms
-- ============================================================================
INSERT OR IGNORE INTO gym_features (gym_id, feature_key, is_enabled, updated_at)
SELECT g.id, f.key, 1, unixepoch()
FROM gyms g
CROSS JOIN (
    SELECT 'dashboard' as key
    UNION SELECT 'members'
    UNION SELECT 'attendance'
    UNION SELECT 'payments'
    UNION SELECT 'pt_collections'
    UNION SELECT 'plans'
    UNION SELECT 'staff'
    UNION SELECT 'reports'
    UNION SELECT 'settings'
) f
WHERE g.deleted_at IS NULL;
