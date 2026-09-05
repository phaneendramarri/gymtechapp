-- Migration: 0001_add_roles_is_owner
-- 1. Ensure roles table exists
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY,
    gym_id INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]',
    is_owner INTEGER NOT NULL DEFAULT 0,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    deleted_at INTEGER
);

-- Seed default OWNER role for gym 1 if missing
INSERT OR IGNORE INTO roles (id, gym_id, name, permissions, is_owner, is_default, created_at, updated_at)
VALUES (1, 1, 'OWNER', '["*"]', 1, 1, unixepoch(), unixepoch());

-- 2. Add role_id and is_owner to users table
ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0;

-- 3. Backfill OWNER role and is_owner for owner users
UPDATE users
SET is_owner = 1,
    role_id = (
        SELECT r.id FROM roles r
        WHERE r.gym_id = users.gym_id
          AND r.name = 'OWNER'
          AND r.deleted_at IS NULL
          AND r.is_owner = 1
        LIMIT 1
    )
WHERE role = 'OWNER' AND deleted_at IS NULL;

