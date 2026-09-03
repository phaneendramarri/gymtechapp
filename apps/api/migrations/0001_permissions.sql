-- ============================================================================
-- GYM SAAS D1 MIGRATION 0001 — User permissions model
-- Replaces role-based access (OWNER/MANAGER/STAFF/TRAINER) with a flat
-- permission-key model. The gym creator becomes is_owner=1, all other gym
-- users are created by the owner with a chosen set of menu permissions.
--
-- What this migration does:
--   1. Adds user_permissions table (user_id + permission_key)
--   2. Adds is_owner flag to users
--   3. Drops role CHECK constraint (keeps column for migration compat, app
--      code stops reading it)
--   4. Back-fills is_owner and default permissions for existing users
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. user_permissions — the new permissions store
CREATE TABLE IF NOT EXISTS user_permissions (
    user_id         INTEGER NOT NULL,
    permission_key  TEXT NOT NULL,
    granted_by      INTEGER,
    granted_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (user_id, permission_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);

-- 2. Add is_owner to users
ALTER TABLE users ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0;

-- 3. Relax the role CHECK so old role values are still valid in the DB
--    (we stop reading role - it stays for a clean rollback path)
DROP INDEX IF EXISTS idx_users_gym_role;
CREATE INDEX IF NOT EXISTS idx_users_gym_owner ON users(gym_id, is_owner);

-- 4. Backfill is_owner: first user ever created per gym = owner
WITH first_users AS (
    SELECT MIN(id) as first_id, gym_id
    FROM users
    WHERE deleted_at IS NULL
    GROUP BY gym_id
)
UPDATE users SET is_owner = 1
WHERE id IN (SELECT first_id FROM first_users);

-- 5. Backfill default permissions for existing users based on old role
--    so nothing breaks during the transition window.

-- 5. Backfill default permissions for existing users based on old role
--    so nothing breaks during the transition window.
WITH v(role, val) AS (
  VALUES 
    ('OWNER', 'dashboard'), ('OWNER', 'members'), ('OWNER', 'attendance'), ('OWNER', 'payments'),
    ('OWNER', 'pt_collections'), ('OWNER', 'plans'), ('OWNER', 'reports'), ('OWNER', 'settings'), ('OWNER', 'audit_logs'),
    ('MANAGER', 'dashboard'), ('MANAGER', 'members'), ('MANAGER', 'attendance'), ('MANAGER', 'payments'),
    ('MANAGER', 'pt_collections'), ('MANAGER', 'plans'), ('MANAGER', 'settings'),
    ('STAFF', 'dashboard'), ('STAFF', 'members'), ('STAFF', 'attendance'), ('STAFF', 'payments'),
    ('TRAINER', 'dashboard'), ('TRAINER', 'members'), ('TRAINER', 'attendance'), ('TRAINER', 'pt_collections')
)
INSERT OR IGNORE INTO user_permissions (user_id, permission_key, granted_by, granted_at)
SELECT u.id, v.val, u.id, unixepoch()
FROM users u
JOIN v ON u.role = v.role;

