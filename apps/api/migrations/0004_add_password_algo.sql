-- ============================================================================
-- Migration 0004: Add password_algo column for hash versioning
-- ============================================================================
-- Tracks the hashing algorithm used to produce `password_hash` so we can
-- lazily upgrade legacy SHA-256 hashes to Argon2id on the next successful
-- login. The algorithm itself is also embedded in the hash string
-- (`$argon2id$…` vs `sha256$<hex>`), so this column is informational
-- rather than authoritative.
--
-- Values:
--   'sha256'  — legacy unsalted SHA-256 (dev seed + pre-migration users)
--   'argon2id' — current standard
-- ============================================================================

PRAGMA foreign_keys = ON;

ALTER TABLE users
    ADD COLUMN password_algo TEXT NOT NULL DEFAULT 'sha256'
    CHECK (password_algo IN ('sha256', 'argon2id'));

ALTER TABLE platform_admins
    ADD COLUMN password_algo TEXT NOT NULL DEFAULT 'sha256'
    CHECK (password_algo IN ('sha256', 'argon2id'));

-- No backfill UPDATE: existing rows keep `password_algo = 'sha256'` and the
-- lazy rehash in AuthService will flip them to 'argon2id' on next login.
