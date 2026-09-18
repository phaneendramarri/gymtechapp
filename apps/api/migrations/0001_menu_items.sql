-- Migration 0001: Database-Driven Menu System and Role Menus
CREATE TABLE IF NOT EXISTS "menu_items" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "key" TEXT NOT NULL UNIQUE,
  "label" TEXT NOT NULL,
  "href" TEXT,
  "icon" TEXT,
  "group_key" TEXT NOT NULL DEFAULT 'main',
  "order" INTEGER NOT NULL DEFAULT 10,
  "feature_key" TEXT,
  "admin_only" INTEGER NOT NULL DEFAULT 0,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch()),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS "idx_menu_items_group_order" ON "menu_items" ("group_key", "order");

CREATE TABLE IF NOT EXISTS "role_menus" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "gym_id" INTEGER NOT NULL REFERENCES "gyms"("id") ON DELETE CASCADE,
  "role_id" INTEGER NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "menu_item_id" INTEGER NOT NULL REFERENCES "menu_items"("id") ON DELETE CASCADE,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE ("gym_id", "role_id", "menu_item_id")
);

CREATE INDEX IF NOT EXISTS "idx_role_menus_gym_role" ON "role_menus" ("gym_id", "role_id");
CREATE INDEX IF NOT EXISTS "idx_role_menus_gym_menu" ON "role_menus" ("gym_id", "menu_item_id");

-- Seed default menu items
INSERT OR IGNORE INTO "menu_items" ("id", "key", "label", "href", "icon", "group_key", "order", "feature_key", "admin_only", "is_active", "created_at", "updated_at") VALUES
  (1, 'dashboard', 'Dashboard', '/dashboard', 'LayoutDashboard', 'main', 10, NULL, 0, 1, 1710000000, 1710000000),
  (2, 'members', 'Members', '/members', 'Users', 'main', 20, 'members', 0, 1, 1710000000, 1710000000),
  (3, 'attendance', 'Floor & Attendance', '/attendance', 'CalendarCheck', 'main', 30, 'attendance', 0, 1, 1710000000, 1710000000),
  (4, 'payments', 'Payments', '/payments', 'CreditCard', 'main', 40, 'payments', 0, 1, 1710000000, 1710000000),
  (5, 'pt_collections', 'PT Sessions', '/pt-collections', 'Trophy', 'main', 50, 'pt_collections', 0, 1, 1710000000, 1710000000),
  (6, 'plans', 'Plans', '/plans', 'Tag', 'main', 60, 'plans', 0, 1, 1710000000, 1710000000),
  (7, 'reports', 'Reports', '/reports', 'BarChart3', 'main', 70, 'reports', 0, 1, 1710000000, 1710000000),
  (8, 'staff', 'Staff Management', '/staff', 'UserCog', 'admin', 80, 'staff', 1, 1, 1710000000, 1710000000),
  (9, 'audit_logs', 'Audit Logs', '/audit-logs', 'Sliders', 'admin', 90, 'audit_logs', 1, 1, 1710000000, 1710000000),
  (10, 'settings', 'Settings', '/settings', 'Settings', 'admin', 100, 'settings', 1, 1, 1710000000, 1710000000);
