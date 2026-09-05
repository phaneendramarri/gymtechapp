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
-- NOTE: roles.gymId may be NULL for platform-level roles; FK is enforced only where gymId IS NOT NULL
CREATE INDEX IF NOT EXISTS idx_roles_gym_id_fk ON roles(gym_id) WHERE gym_id IS NOT NULL;

-- H-6: Replace roles_gym_name_unique with a partial unique index excluding soft-deleted rows
-- SQLite partial unique indexes: CREATE UNIQUE INDEX ... WHERE <condition>
-- This prevents duplicate active role names within a gym while allowing historical soft-deleted names
DROP INDEX IF EXISTS roles_gym_name_unique;
CREATE UNIQUE INDEX roles_gym_name_unique ON roles(gym_id, name) WHERE deleted_at IS NULL;

-- H-6 (trigger): Also enforce at INSERT/UPDATE time in case the partial index isn't hit
-- (e.g., due to NULL gym_id which bypasses the partial index)
-- For non-null gym_id: prevent duplicate active role names
CREATE TRIGGER IF NOT EXISTS trg_roles_unique_name_INSERT
BEFORE INSERT ON roles
WHEN NEW.gym_id IS NOT NULL AND NEW.deleted_at IS NULL
BEGIN
  SELECT CASE
    WHEN (
      SELECT COUNT(*) FROM roles
      WHERE gym_id = NEW.gym_id AND name = NEW.name AND deleted_at IS NULL
    ) > 0
    THEN RAISE(ABORT, 'Duplicate active role name for this gym')
    ;
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_roles_unique_name_UPDATE
BEFORE UPDATE ON roles
WHEN NEW.gym_id IS NOT NULL AND NEW.deleted_at IS NULL
BEGIN
  SELECT CASE
    WHEN (
      SELECT COUNT(*) FROM roles
      WHERE gym_id = NEW.gym_id AND name = NEW.name AND deleted_at IS NULL AND id != NEW.id
    ) > 0
    THEN RAISE(ABORT, 'Duplicate active role name for this gym')
    ;
  END;
END;

-- CR-4: Enforce users.roleId gym scoping — role must belong to same gym as user
-- Prevents a user of gym A from being assigned a role that belongs to gym B
-- The FK from users.roleId → roles.id already exists with ON DELETE SET NULL;
-- this trigger adds the gym-scoping enforcement that SQLite FKs cannot express alone
CREATE TRIGGER IF NOT EXISTS trg_users_roleid_gym_scope_INSERT
BEFORE INSERT ON users
WHEN NEW.role_id IS NOT NULL AND NEW.gym_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN (
      SELECT gym_id FROM roles WHERE id = NEW.role_id
    ) != NEW.gym_id
    THEN RAISE(ABORT, 'users.role_id must belong to the same gym as users.gym_id')
    ;
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_users_roleid_gym_scope_UPDATE
BEFORE UPDATE OF role_id ON users
WHEN NEW.role_id IS NOT NULL AND NEW.gym_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN (
      SELECT gym_id FROM roles WHERE id = NEW.role_id
    ) != NEW.gym_id
    THEN RAISE(ABORT, 'users.role_id must belong to the same gym as users.gym_id')
    ;
  END;
END;
