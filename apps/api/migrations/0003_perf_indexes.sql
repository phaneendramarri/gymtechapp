-- ============================================================================
-- Migration 0003: Performance indexes for high-frequency queries
-- ============================================================================
PRAGMA foreign_keys = ON;

-- 1. Accelerate member list latest-membership subquery
-- Satisfies: WHERE memberId = m.id AND gymId = m.gymId AND deletedAt IS NULL ORDER BY endDate DESC LIMIT 1
CREATE INDEX IF NOT EXISTS idxMembershipsGymMemberActiveEnd
  ON memberships(gymId, memberId, deletedAt, endDate DESC);

-- 2. Accelerate payments listing by member and date
CREATE INDEX IF NOT EXISTS idxPaymentsGymMemberDate
  ON payments(gymId, memberId, paymentDate DESC);
