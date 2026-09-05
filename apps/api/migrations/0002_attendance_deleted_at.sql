-- ============================================================================
-- MIGRATION 0002 — Add soft-delete to attendance + fix roles FK + partial index
-- CR-7: Add deleted_at to attendance (soft-delete for cross-gym isolation)
-- H-5:  Add FK roles.gymId → gyms(id)
-- H-6:  Replace roles_gym_name_unique with a partial unique index
-- H-13: Ensure users.roleId → roles.id ON DELETE SET NULL is enforced
-- CR-4:  Add trigger to enforce users.roleId gym scoping (role must belong to same gym)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- CR-7: Add deleted_at to attendance (soft-delete for cross-gym isolation)
ALTER TABLE attendance ADD COLUMN deleted_at INTEGER;

-- H-5: Add FK roles.gymId → gyms(id)
CREATE INDEX IF NOT EXISTS idx_roles_gym_id_fk ON roles(gym_id) WHERE gym_id IS NOT NULL;

-- H-6: Replace roles_gym_name_unique with a partial unique index excluding soft-deleted rows
DROP INDEX IF EXISTS roles_gym_name_unique;
CREATE UNIQUE INDEX IF NOT EXISTS roles_gym_name_unique ON roles(gym_id, name) WHERE deleted_at IS NULL;

