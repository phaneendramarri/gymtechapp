-- Migration 0002: Advanced Modules — Classes, PT Packages, POS Inventory, Expenses, Lockers, Referrals

-- 1. classes (group fitness offerings)
CREATE TABLE IF NOT EXISTS "classes" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "gym_id" INTEGER NOT NULL REFERENCES "gyms"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "duration_minutes" INTEGER NOT NULL DEFAULT 60,
  "max_capacity" INTEGER NOT NULL DEFAULT 20,
  "color" TEXT NOT NULL DEFAULT '#4f46e5',
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch()),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS "classes_gym_id_unique" ON "classes" ("gym_id", "id");
CREATE INDEX IF NOT EXISTS "idx_classes_gym_name" ON "classes" ("gym_id", "name");

-- 2. class_schedules (weekly timetables & one-off classes)
CREATE TABLE IF NOT EXISTS "class_schedules" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "gym_id" INTEGER NOT NULL REFERENCES "gyms"("id") ON DELETE CASCADE,
  "class_id" INTEGER NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
  "trainer_user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "day_of_week" INTEGER NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "date" TEXT,
  "max_capacity" INTEGER NOT NULL DEFAULT 20,
  "is_cancelled" INTEGER NOT NULL DEFAULT 0,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS "class_schedules_gym_id_unique" ON "class_schedules" ("gym_id", "id");
CREATE INDEX IF NOT EXISTS "idx_class_schedules_gym_class" ON "class_schedules" ("gym_id", "class_id");
CREATE INDEX IF NOT EXISTS "idx_class_schedules_gym_day" ON "class_schedules" ("gym_id", "day_of_week");

-- 3. class_bookings (member reservations)
CREATE TABLE IF NOT EXISTS "class_bookings" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "gym_id" INTEGER NOT NULL REFERENCES "gyms"("id") ON DELETE CASCADE,
  "schedule_id" INTEGER NOT NULL REFERENCES "class_schedules"("id") ON DELETE CASCADE,
  "member_id" INTEGER NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'BOOKED',
  "booked_at" INTEGER NOT NULL DEFAULT (unixepoch()),
  "attended_at" INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS "class_bookings_gym_id_unique" ON "class_bookings" ("gym_id", "id");
CREATE INDEX IF NOT EXISTS "idx_class_bookings_gym_schedule" ON "class_bookings" ("gym_id", "schedule_id");
CREATE INDEX IF NOT EXISTS "idx_class_bookings_gym_member" ON "class_bookings" ("gym_id", "member_id");

-- 4. pt_packages (personal training agreements)
CREATE TABLE IF NOT EXISTS "pt_packages" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "gym_id" INTEGER NOT NULL REFERENCES "gyms"("id") ON DELETE CASCADE,
  "member_id" INTEGER NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
  "trainer_user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "total_sessions" INTEGER NOT NULL,
  "completed_sessions" INTEGER NOT NULL DEFAULT 0,
  "price_paise" INTEGER NOT NULL,
  "start_date" TEXT NOT NULL,
  "expiry_date" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch()),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS "pt_packages_gym_id_unique" ON "pt_packages" ("gym_id", "id");
CREATE INDEX IF NOT EXISTS "idx_pt_packages_gym_member" ON "pt_packages" ("gym_id", "member_id");
CREATE INDEX IF NOT EXISTS "idx_pt_packages_gym_trainer" ON "pt_packages" ("gym_id", "trainer_user_id");

-- 5. pt_sessions (individual workout logs)
CREATE TABLE IF NOT EXISTS "pt_sessions" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "gym_id" INTEGER NOT NULL REFERENCES "gyms"("id") ON DELETE CASCADE,
  "package_id" INTEGER NOT NULL REFERENCES "pt_packages"("id") ON DELETE CASCADE,
  "session_number" INTEGER NOT NULL,
  "session_date" TEXT NOT NULL,
  "notes" TEXT,
  "trainer_user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "signed_off_by_member" INTEGER NOT NULL DEFAULT 1,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS "pt_sessions_gym_id_unique" ON "pt_sessions" ("gym_id", "id");
CREATE INDEX IF NOT EXISTS "idx_pt_sessions_gym_package" ON "pt_sessions" ("gym_id", "package_id");

-- 6. products (POS retail & supplement catalog)
CREATE TABLE IF NOT EXISTS "products" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "gym_id" INTEGER NOT NULL REFERENCES "gyms"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "sku" TEXT,
  "category" TEXT NOT NULL DEFAULT 'General',
  "price_paise" INTEGER NOT NULL,
  "cost_paise" INTEGER NOT NULL DEFAULT 0,
  "stock_quantity" INTEGER NOT NULL DEFAULT 0,
  "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
  "tax_rate" REAL NOT NULL DEFAULT 0,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch()),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS "products_gym_id_unique" ON "products" ("gym_id", "id");
CREATE INDEX IF NOT EXISTS "idx_products_gym_name" ON "products" ("gym_id", "name");

-- 7. pos_sales (POS transactions)
CREATE TABLE IF NOT EXISTS "pos_sales" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "gym_id" INTEGER NOT NULL REFERENCES "gyms"("id") ON DELETE CASCADE,
  "receipt_number" TEXT NOT NULL,
  "member_id" INTEGER REFERENCES "members"("id") ON DELETE SET NULL,
  "subtotal_paise" INTEGER NOT NULL,
  "tax_paise" INTEGER NOT NULL DEFAULT 0,
  "total_paise" INTEGER NOT NULL,
  "payment_mode" TEXT NOT NULL DEFAULT 'CASH',
  "notes" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS "pos_sales_gym_id_unique" ON "pos_sales" ("gym_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "pos_sales_gym_receipt_unique" ON "pos_sales" ("gym_id", "receipt_number");
CREATE INDEX IF NOT EXISTS "idx_pos_sales_gym_member" ON "pos_sales" ("gym_id", "member_id");

-- 8. pos_sale_items (items sold in POS transaction)
CREATE TABLE IF NOT EXISTS "pos_sale_items" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "gym_id" INTEGER NOT NULL REFERENCES "gyms"("id") ON DELETE CASCADE,
  "sale_id" INTEGER NOT NULL REFERENCES "pos_sales"("id") ON DELETE CASCADE,
  "product_id" INTEGER NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "quantity" INTEGER NOT NULL,
  "unit_price_paise" INTEGER NOT NULL,
  "total_paise" INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "pos_sale_items_gym_id_unique" ON "pos_sale_items" ("gym_id", "id");
CREATE INDEX IF NOT EXISTS "idx_pos_sale_items_gym_sale" ON "pos_sale_items" ("gym_id", "sale_id");

-- 9. expense_categories (gym expense categories)
CREATE TABLE IF NOT EXISTS "expense_categories" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "gym_id" INTEGER NOT NULL REFERENCES "gyms"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_gym_id_unique" ON "expense_categories" ("gym_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_gym_name_unique" ON "expense_categories" ("gym_id", "name");

-- 10. expenses (expenditure records)
CREATE TABLE IF NOT EXISTS "expenses" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "gym_id" INTEGER NOT NULL REFERENCES "gyms"("id") ON DELETE CASCADE,
  "category_id" INTEGER NOT NULL REFERENCES "expense_categories"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "amount_paise" INTEGER NOT NULL,
  "expense_date" TEXT NOT NULL,
  "payment_mode" TEXT NOT NULL DEFAULT 'CASH',
  "vendor" TEXT,
  "receipt_url" TEXT,
  "created_by_user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS "expenses_gym_id_unique" ON "expenses" ("gym_id", "id");
CREATE INDEX IF NOT EXISTS "idx_expenses_gym_date" ON "expenses" ("gym_id", "expense_date");
CREATE INDEX IF NOT EXISTS "idx_expenses_gym_category" ON "expenses" ("gym_id", "category_id");

-- 11. lockers (physical lockers)
CREATE TABLE IF NOT EXISTS "lockers" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "gym_id" INTEGER NOT NULL REFERENCES "gyms"("id") ON DELETE CASCADE,
  "locker_number" TEXT NOT NULL,
  "zone" TEXT,
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS "lockers_gym_id_unique" ON "lockers" ("gym_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "lockers_gym_number_unique" ON "lockers" ("gym_id", "locker_number");

-- 12. locker_allocations (locker rentals to members)
CREATE TABLE IF NOT EXISTS "locker_allocations" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "gym_id" INTEGER NOT NULL REFERENCES "gyms"("id") ON DELETE CASCADE,
  "locker_id" INTEGER NOT NULL REFERENCES "lockers"("id") ON DELETE CASCADE,
  "member_id" INTEGER NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
  "start_date" TEXT NOT NULL,
  "end_date" TEXT NOT NULL,
  "deposit_paise" INTEGER NOT NULL DEFAULT 0,
  "rent_paise" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS "locker_allocations_gym_id_unique" ON "locker_allocations" ("gym_id", "id");
CREATE INDEX IF NOT EXISTS "idx_locker_allocations_gym_locker" ON "locker_allocations" ("gym_id", "locker_id");
CREATE INDEX IF NOT EXISTS "idx_locker_allocations_gym_member" ON "locker_allocations" ("gym_id", "member_id");

-- 13. member_referrals (referral attribution)
CREATE TABLE IF NOT EXISTS "member_referrals" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "gym_id" INTEGER NOT NULL REFERENCES "gyms"("id") ON DELETE CASCADE,
  "referrer_member_id" INTEGER NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
  "referred_member_id" INTEGER NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
  "reward_status" TEXT NOT NULL DEFAULT 'PENDING',
  "reward_notes" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS "member_referrals_gym_id_unique" ON "member_referrals" ("gym_id", "id");
CREATE INDEX IF NOT EXISTS "idx_member_referrals_gym_referrer" ON "member_referrals" ("gym_id", "referrer_member_id");

-- 14. Seed new menu items
INSERT OR IGNORE INTO "menu_items" ("id", "key", "label", "href", "icon", "group_key", "order", "feature_key", "admin_only", "is_active", "created_at", "updated_at") VALUES
  (11, 'classes', 'Group Classes', '/classes', 'Calendar', 'main', 35, 'classes', 0, 1, 1710000000, 1710000000),
  (12, 'pos', 'POS & Store', '/pos', 'ShoppingBag', 'main', 45, 'pos', 0, 1, 1710000000, 1710000000),
  (13, 'expenses', 'Expenses & P&L', '/expenses', 'Receipt', 'main', 75, 'expenses', 0, 1, 1710000000, 1710000000),
  (14, 'lockers', 'Locker System', '/lockers', 'Lock', 'main', 85, 'lockers', 0, 1, 1710000000, 1710000000);
