-- Migration: Add menu_groups and menu_items tables
-- Run this AFTER the base schema migration (0000_init.sql)

-- ============================================================
-- menu_groups
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ============================================================
-- menu_items
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_key TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  href TEXT,
  icon TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  permissions TEXT NOT NULL DEFAULT '[]',
  feature_key TEXT,
  admin_only INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (group_key) REFERENCES menu_groups(key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_menu_items_group_order ON menu_items(group_key, "order");
CREATE INDEX IF NOT EXISTS idx_menu_items_active ON menu_items(is_active);

-- ============================================================
-- Seed: menu_groups  (order = sidebar section sequence)
-- ============================================================
INSERT INTO menu_groups (key, label, icon, "order", is_active, created_at, updated_at) VALUES
  ('members',     'Members',          'Users',          10, 1, unixepoch(), unixepoch()),
  ('attendance',  'Attendance',       'CalendarCheck',  20, 1, unixepoch(), unixepoch()),
  ('payments',    'Payments',         'CreditCard',     30, 1, unixepoch(), unixepoch()),
  ('pt',          'PT Collections',   'Trophy',         40, 1, unixepoch(), unixepoch()),
  ('plans',       'Plans',            'Tag',            50, 1, unixepoch(), unixepoch()),
  ('staff',       'Staff & Roles',    'UserCog',        60, 1, unixepoch(), unixepoch()),
  ('reports',     'Reports',          'BarChart3',      70, 1, unixepoch(), unixepoch()),
  ('settings',    'Settings',         'Settings',       80, 1, unixepoch(), unixepoch()),
  ('audit',       'Audit Logs',       'History',        90, 1, unixepoch(), unixepoch()),
  ('portal',      'Member Portal',    'IdCard',        100, 1, unixepoch(), unixepoch()),
  ('platform',    'Platform',         'Server',        200, 1, unixepoch(), unixepoch());

-- ============================================================
-- Seed: menu_items
-- Permissions format: JSON array. Empty [] = public (any logged-in user).
-- Use action suffixes: _add, _edit, _delete, _export, _freeze, _restore, _settle
-- ============================================================

-- Members group
INSERT INTO menu_items (group_key, key, label, href, icon, "order", permissions, feature_key, admin_only, is_active, created_at, updated_at) VALUES
  ('members', 'members_list',      'All Members',       '/members',             'Users',      10, '["members"]',                              null, 0, 1, unixepoch(), unixepoch()),
  ('members', 'member_add',        'Add Member',         '/members/new',        'UserPlus',   20, '["members","add"]',                       null, 0, 1, unixepoch(), unixepoch()),
  ('members', 'member_detail',     'Member Detail',      '/members/:id',        'Users',      30, '["members"]',                             null, 0, 1, unixepoch(), unixepoch()),
  ('members', 'member_renew',      'Renew Member',       '/members/:id/renew',   'Tag',        40, '["members"]',                             null, 0, 1, unixepoch(), unixepoch()),
  ('members', 'member_export',     'Export Members',     '/members/export',      'Download',   50, '["members","export"]',                    null, 0, 1, unixepoch(), unixepoch()),
  ('members', 'member_freeze',     'Freeze Member',      null,                  'Snowflake',  60, '["members","freeze"]',                    null, 0, 1, unixepoch(), unixepoch()),
  ('members', 'member_unfreeze',   'Unfreeze Member',    null,                  'Snowflake',  70, '["members","unfreeze"]',                  null, 0, 1, unixepoch(), unixepoch()),
  ('members', 'member_delete',     'Delete Member',      null,                  'Trash',      80, '["members","delete"]',                    null, 0, 1, unixepoch(), unixepoch()),
  ('members', 'member_restore',    'Restore Member',     null,                  'RotateCcw',  90, '["members","restore"]',                   null, 0, 1, unixepoch(), unixepoch()),
  ('members', 'member_erase',      'Erase Member Data',  null,                  'Eraser',    100, '["members","erase"]',                    null, 0, 1, unixepoch(), unixepoch());

-- Attendance group
INSERT INTO menu_items (group_key, key, label, href, icon, "order", permissions, feature_key, admin_only, is_active, created_at, updated_at) VALUES
  ('attendance', 'attendance_floor',    'Floor / Check-in', '/attendance',             'CalendarCheck', 10, '["attendance"]',                      null, 0, 1, unixepoch(), unixepoch()),
  ('attendance', 'attendance_mark',     'Mark Attendance',  '/attendance/mark',       'Check',         20, '["attendance","mark"]',              null, 0, 1, unixepoch(), unixepoch()),
  ('attendance', 'attendance_unmark',   'Unmark Attendance', '/attendance/unmark',     'X',             30, '["attendance","unmark"]',            null, 0, 1, unixepoch(), unixepoch()),
  ('attendance', 'attendance_checkin',  'Desk Check-in',    '/attendance/check-in',    'CalendarCheck', 40, '["attendance"]',                      null, 0, 1, unixepoch(), unixepoch());

-- Payments group
INSERT INTO menu_items (group_key, key, label, href, icon, "order", permissions, feature_key, admin_only, is_active, created_at, updated_at) VALUES
  ('payments', 'payments_list',     'All Payments',    '/payments',          'CreditCard', 10, '["payments"]',                           null, 0, 1, unixepoch(), unixepoch()),
  ('payments', 'payment_add',       'Record Payment',   '/payments/new',       'Receipt',    20, '["payments","add"]',                    null, 0, 1, unixepoch(), unixepoch()),
  ('payments', 'payment_detail',    'Payment Detail',   '/payments/:id',      'CreditCard', 30, '["payments"]',                           null, 0, 1, unixepoch(), unixepoch()),
  ('payments', 'payment_invoice',   'View Invoice',      null,                 'FileText',   40, '["payments"]',                           null, 0, 1, unixepoch(), unixepoch());

-- PT Collections group
INSERT INTO menu_items (group_key, key, label, href, icon, "order", permissions, feature_key, admin_only, is_active, created_at, updated_at) VALUES
  ('pt', 'pt_collections',  'Collections',       '/pt-collections',       'Trophy',  10, '["pt_collections"]',             'pt_collections', 0, 1, unixepoch(), unixepoch()),
  ('pt', 'pt_settle',      'Settle Collection',  null,                    'Trophy',  20, '["pt_collections","settle"]',      'pt_collections', 0, 1, unixepoch(), unixepoch());

-- Plans group
INSERT INTO menu_items (group_key, key, label, href, icon, "order", permissions, feature_key, admin_only, is_active, created_at, updated_at) VALUES
  ('plans', 'plans_list',    'All Plans',    '/plans',      'Tag',   10, '["plans"]',               null, 0, 1, unixepoch(), unixepoch()),
  ('plans', 'plan_add',      'Add Plan',     '/plans/new',  'Plus',  20, '["plans","add"]',         null, 0, 1, unixepoch(), unixepoch()),
  ('plans', 'plan_detail',   'Plan Detail',  '/plans/:id',  'Tag',   30, '["plans"]',               null, 0, 1, unixepoch(), unixepoch()),
  ('plans', 'plan_restore',  'Restore Plan', null,          'RotateCcw', 40, '["plans","restore"]', null, 0, 1, unixepoch(), unixepoch());

-- Staff & Roles group
INSERT INTO menu_items (group_key, key, label, href, icon, "order", permissions, feature_key, admin_only, is_active, created_at, updated_at) VALUES
  ('staff', 'staff_list',    'Team',           '/staff',           'UserCog',      10, '["staff"]',                null, 0, 1, unixepoch(), unixepoch()),
  ('staff', 'staff_add',     'Add Staff',      '/staff/new',       'UserPlus',     20, '["staff","add"]',          null, 0, 1, unixepoch(), unixepoch()),
  ('staff', 'staff_detail',  'Staff Detail',   '/staff/:id',       'UserCog',      30, '["staff"]',                null, 0, 1, unixepoch(), unixepoch()),
  ('staff', 'staff_restore', 'Restore Staff',  null,               'RotateCcw',   40, '["staff","restore"]',       null, 0, 1, unixepoch(), unixepoch()),
  ('staff', 'roles_list',    'Roles',          '/staff/roles',     'ShieldCheck', 50, '["staff"]',                null, 0, 1, unixepoch(), unixepoch()),
  ('staff', 'role_add',      'Add Role',       '/staff/roles/new', 'Shield',      60, '["staff","add"]',          null, 0, 1, unixepoch(), unixepoch()),
  ('staff', 'role_edit',     'Edit Role',      '/staff/roles/:id', 'ShieldCheck', 70, '["staff","edit"]',         null, 0, 1, unixepoch(), unixepoch());

-- Reports group
INSERT INTO menu_items (group_key, key, label, href, icon, "order", permissions, feature_key, admin_only, is_active, created_at, updated_at) VALUES
  ('reports', 'reports_list',   'All Reports',    '/reports',           'BarChart3', 10, '["reports"]',                null, 0, 1, unixepoch(), unixepoch()),
  ('reports', 'report_export', 'Export Report',  '/reports/export',    'Download',  20, '["reports","export"]',       null, 0, 1, unixepoch(), unixepoch());

-- Settings group
INSERT INTO menu_items (group_key, key, label, href, icon, "order", permissions, feature_key, admin_only, is_active, created_at, updated_at) VALUES
  ('settings', 'settings_notifications', 'Notifications',  '/settings/notifications', 'Bell',    10, '["settings"]',               null, 0, 1, unixepoch(), unixepoch()),
  ('settings', 'settings_general',       'General',          '/settings/general',       'Sliders', 20, '["settings"]',               null, 0, 1, unixepoch(), unixepoch()),
  ('settings', 'settings_gym',            'Gym Profile',      '/settings/gym',          'Building2',30,'["settings"]',               null, 0, 1, unixepoch(), unixepoch());

-- Audit Logs group
INSERT INTO menu_items (group_key, key, label, href, icon, "order", permissions, feature_key, admin_only, is_active, created_at, updated_at) VALUES
  ('audit', 'audit_logs', 'Audit Log', '/audit-logs', 'History', 10, '["audit_logs"]', null, 0, 1, unixepoch(), unixepoch());

-- Member Portal group (public — any logged-in user)
INSERT INTO menu_items (group_key, key, label, href, icon, "order", permissions, feature_key, admin_only, is_active, created_at, updated_at) VALUES
  ('portal', 'portal', 'My Portal', '/portal', 'IdCard', 10, '[]', null, 0, 1, unixepoch(), unixepoch());

-- Platform Admin group (adminOnly = true)
INSERT INTO menu_items (group_key, key, label, href, icon, "order", permissions, feature_key, admin_only, is_active, created_at, updated_at) VALUES
  ('platform', 'admin_dashboard',  'Super Admin',    '/admin',           'Shield',     10, '[]',                    null, 1, 1, unixepoch(), unixepoch()),
  ('platform', 'admin_gyms',        'Manage Gyms',    '/admin/gyms',      'Building2',  20, '[]',                    null, 1, 1, unixepoch(), unixepoch()),
  ('platform', 'admin_licenses',   'Licenses',        '/admin/licenses',  'Key',        30, '[]',                    null, 1, 1, unixepoch(), unixepoch()),
  ('platform', 'admin_audit',      'Platform Audit', '/admin/audit',     'History',    40, '[]',                    null, 1, 1, unixepoch(), unixepoch()),
  ('platform', 'admin_topup',      'Top-up Credits',  '/admin/topup',    'CreditCard', 50, '[]',                    null, 1, 1, unixepoch(), unixepoch()),
  ('platform', 'admin_comms',      'Communications', '/admin/comms',     'Bell',       60, '[]',                    null, 1, 1, unixepoch(), unixepoch());
