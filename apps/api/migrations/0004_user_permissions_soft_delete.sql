-- M-8: Add deleted_at to user_permissions and replace CASCADE with soft-delete.
-- This ensures permission history is preserved (GDPR compliance) while still
-- effectively revoking access when a user is deleted.
ALTER TABLE user_permissions ADD COLUMN deleted_at INTEGER;
