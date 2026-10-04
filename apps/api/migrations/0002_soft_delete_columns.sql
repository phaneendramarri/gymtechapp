-- ============================================================================
-- Migration 0002: Add soft-delete (deletedAt) columns to remaining tables
-- ============================================================================
-- These tables were missing the standard `deletedAt` column used by the
-- application's soft-delete pattern. Adding it now enables consistent
-- "archive instead of destroy" behavior across all tenant-owned tables.

PRAGMA foreign_keys = ON;

-- 1. menuItems (global catalog - soft-delete catalog items)
ALTER TABLE menuItems ADD COLUMN deletedAt INTEGER;
CREATE INDEX idxMenuItemsDeleted ON menuItems(deletedAt);

-- 2. classSchedules
ALTER TABLE classSchedules ADD COLUMN deletedAt INTEGER;
CREATE INDEX idxClassSchedulesGymDeleted ON classSchedules(gymId, deletedAt);

-- 3. classBookings
ALTER TABLE classBookings ADD COLUMN deletedAt INTEGER;
CREATE INDEX idxClassBookingsGymDeleted ON classBookings(gymId, deletedAt);

-- 4. ptSessions
ALTER TABLE ptSessions ADD COLUMN deletedAt INTEGER;
CREATE INDEX idxPtSessionsGymDeleted ON ptSessions(gymId, deletedAt);

-- 5. products
ALTER TABLE products ADD COLUMN deletedAt INTEGER;
CREATE INDEX idxProductsGymDeleted ON products(gymId, deletedAt);

-- 6. posSales
ALTER TABLE posSales ADD COLUMN deletedAt INTEGER;
CREATE INDEX idxPosSalesGymDeleted ON posSales(gymId, deletedAt);

-- 7. posSaleItems
ALTER TABLE posSaleItems ADD COLUMN deletedAt INTEGER;
CREATE INDEX idxPosSaleItemsGymDeleted ON posSaleItems(gymId, deletedAt);

-- 8. expenseCategories
ALTER TABLE expenseCategories ADD COLUMN deletedAt INTEGER;
CREATE INDEX idxExpenseCategoriesGymDeleted ON expenseCategories(gymId, deletedAt);

-- 9. expenses
ALTER TABLE expenses ADD COLUMN deletedAt INTEGER;
CREATE INDEX idxExpensesGymDeleted ON expenses(gymId, deletedAt);

-- 10. lockers
ALTER TABLE lockers ADD COLUMN deletedAt INTEGER;
CREATE INDEX idxLockersGymDeleted ON lockers(gymId, deletedAt);

-- 11. lockerAllocations
ALTER TABLE lockerAllocations ADD COLUMN deletedAt INTEGER;
CREATE INDEX idxLockerAllocationsGymDeleted ON lockerAllocations(gymId, deletedAt);

-- Also add deletedAt to platformSettings for consistency (optional but clean)
-- Note: platformSettings is a global singleton, not gym-scoped
ALTER TABLE platformSettings ADD COLUMN deletedAt INTEGER;

-- Backfill existing rows with NULL (active) - no-op since default is NULL
-- No UPDATE needed; NULL = not deleted