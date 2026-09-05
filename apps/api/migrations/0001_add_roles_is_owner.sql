-- Migration: 0001_add_roles_is_owner
-- Adds is_owner boolean to roles table (per-gym role that marks the owner role).
-- Then backfills isOwner=true for every gym's OWNER role and updates
-- owner users to point to that role via roleId.

-- 1. Add is_owner column to roles
ALTER TABLE roles ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0;

-- 2. For each gym, find the role named 'OWNER' and mark it as is_owner = 1
UPDATE roles SET is_owner = 1 WHERE name = 'OWNER' AND deleted_at IS NULL;

-- 3. Backfill roleId on owner users so they reference their gym's OWNER role
UPDATE users
SET role_id = (
    SELECT r.id FROM roles r
    WHERE r.gym_id = users.gym_id
      AND r.name = 'OWNER'
      AND r.deleted_at IS NULL
      AND r.is_owner = 1
    LIMIT 1
)
WHERE users.is_owner = 1 AND users.deleted_at IS NULL;

-- 4. Keep is_owner on users as a read-compat column (not null default false)
-- It is NOT dropped here so existing code that references it stays functional.
-- A future migration can remove it after all consumers are updated.
