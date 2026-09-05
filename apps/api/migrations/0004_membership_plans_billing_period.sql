-- Migration: 0004_membership_plans_billing_period.sql
-- Phase 5 L9/L10: Add billing_period to membership_plans for server-side revenue bucketing
--
-- Since SQLite/D1 does not support ALTER TABLE to add columns with constraints,
-- this requires recreation of the table. All data must be migrated.
--
-- ADDING COLUMN (app-level enforcement, not DB-enforced):
--   ALTER TABLE membership_plans ADD COLUMN billing_period TEXT DEFAULT 'MONTHLY'
--   CHECK(billing_period IN ('MONTHLY', 'YEARLY'));
--
-- After this migration, all membership_plans without an explicit billing_period
-- default to 'MONTHLY'. The application layer validates billing period values.

-- Step 1: Create new table with billing_period column
CREATE TABLE IF NOT EXISTS membership_plans_new (
  id INTEGER PRIMARY KEY,
  gym_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_months INTEGER NOT NULL,
  price_paise INTEGER NOT NULL,
  admission_fee_paise INTEGER NOT NULL DEFAULT 0,
  tax_percentage REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  billing_period TEXT NOT NULL DEFAULT 'MONTHLY',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  UNIQUE(gym_id, name)
);

-- Step 2: Migrate data (all existing plans become MONTHLY)
INSERT OR IGNORE INTO membership_plans_new (
  id, gym_id, name, description, duration_months, price_paise,
  admission_fee_paise, tax_percentage, is_active, billing_period,
  created_at, updated_at, deleted_at
)
SELECT
  id, gym_id, name, description, duration_months, price_paise,
  admission_fee_paise, tax_percentage, is_active, 'MONTHLY',
  created_at, updated_at, deleted_at
FROM membership_plans;

-- Step 3: Drop old table
DROP TABLE membership_plans;

-- Step 4: Rename new table
ALTER TABLE membership_plans_new RENAME TO membership_plans;

-- Step 5: Recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS membership_plans_gym_name_unique ON membership_plans (gym_id, name);
CREATE INDEX IF NOT EXISTS idx_membership_plans_gym_active ON membership_plans (gym_id, is_active, deleted_at);
