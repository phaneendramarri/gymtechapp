-- ============================================================================
-- Migration 0005: Add lockout columns to platform_admins
-- ============================================================================
-- `users` already has `failed_login_count` and `locked_until` (0000_init_v3).
-- Platform admin accounts are higher-value targets (full cross-tenant
-- access), so we apply the same progressive lockout policy.
-- ============================================================================

PRAGMA foreign_keys = ON;

ALTER TABLE platform_admins
    ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0
    CHECK (failed_login_count >= 0);

ALTER TABLE platform_admins
    ADD COLUMN locked_until INTEGER;
