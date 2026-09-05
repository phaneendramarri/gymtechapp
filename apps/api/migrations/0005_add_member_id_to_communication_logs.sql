-- Migration: 0005_add_member_id_to_communication_logs.sql
-- Phase 3 (H-9): Add nullable member_id column to communication_logs.
--
-- Rationale: communication_logs currently has no memberId column, making GDPR
-- erasure of communication logs impossible when a member exercises their right
-- to deletion (Article 17 GDPR). This column links each log entry to the
-- member it pertains to, enabling targeted deletion.
--
-- The column is nullable to remain backward-compatible with existing rows
-- where the dispatched_by_id may represent a staff member (not a member).
--
-- Status: REVERSIBLE — column can be dropped if scope changes.

ALTER TABLE communication_logs
  ADD COLUMN member_id integer
  REFERENCES members(id)
  ON DELETE SET NULL;

-- Index for fast GDPR erasure queries: SELECT * FROM communication_logs WHERE member_id = ?
CREATE INDEX IF NOT EXISTS idx_comm_logs_member
  ON communication_logs(member_id);
