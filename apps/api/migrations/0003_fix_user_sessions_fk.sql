-- ============================================================================
-- Migration 0003: Recreate user_sessions without rigid users FK
-- Allows platform admin sessions (gym_id = 0) while keeping all session indexes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_sessions_new (
    id                      INTEGER PRIMARY KEY,
    gym_id                  INTEGER NOT NULL,
    user_id                 INTEGER NOT NULL,
    token_hash              TEXT NOT NULL UNIQUE,
    refresh_token_hash     TEXT,
    refresh_token_expires_at INTEGER,
    ip                      TEXT,
    user_agent              TEXT,
    issued_at               INTEGER NOT NULL,
    expires_at              INTEGER NOT NULL,
    revoked_at              INTEGER
);

INSERT OR IGNORE INTO user_sessions_new SELECT * FROM user_sessions;

DROP TABLE user_sessions;

ALTER TABLE user_sessions_new RENAME TO user_sessions;

CREATE INDEX IF NOT EXISTS idx_user_sessions_gym_user ON user_sessions(gym_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- Add Platform Root Gym (id = 0)
INSERT OR IGNORE INTO gyms (id, name, slug, phone, email, status, created_at, updated_at)
VALUES (0, 'Platform Administration', 'platform-admin', '0000000000', 'admin@gymtech.app', 'ACTIVE', unixepoch(), unixepoch());

