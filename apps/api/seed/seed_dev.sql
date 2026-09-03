-- ============================================================================
-- DEVELOPMENT / TEST SEED DATA  (never apply to production)
-- Creates a demo gym with an owner, staff, trainer, membership plans,
-- members, memberships, payments and attendance for local development
-- and Playwright E2E tests.
--
-- Apply with:  pnpm --filter @gymtech/api db:seed:local
-- ============================================================================
--
-- v3 multi-tenant schema. All ids are integers, all money in paise, all
-- timestamps in unix seconds, all enums are TEXT.
-- ============================================================================

-- Demo Gym (Single Location)
INSERT OR IGNORE INTO gyms (id, name, slug, phone, email, address, city, state, pincode, gst_number, currency, status, created_at, updated_at)
VALUES
(1, 'Iron House Fitness', 'iron-house-fitness', '9876543210', 'contact@ironhouse.in',
 'Road No 36, Jubilee Hills', 'Hyderabad', 'Telangana', '500033', '36AAAAA0000A1Z5',
 'INR', 'ACTIVE', unixepoch(), unixepoch());

INSERT OR IGNORE INTO platform_admins (id, email, password_hash, password_algo, name, status, created_at, updated_at)
VALUES
(1, 'admin@gymtech.app', 'sha256$240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'sha256',
    'Platform Admin', 'ACTIVE', unixepoch(), unixepoch());

-- Demo license (plan metadata inlined)
INSERT OR IGNORE INTO licenses (
    id, gym_id, name, code, price_paise, billing_period,
    max_members, max_owners, max_managers, max_staff_total,
    max_sms, max_whatsapp, max_email, features,
    started_at, expires_at, status, created_at, updated_at
) VALUES (
    1, 1, 'Professional', 'PRO', 1999900, 'YEARLY',
    500, 1, 5, 10, 0, 0, 0, '{"reports": true, "qr_attendance": true, "whatsapp_links": true}',
    unixepoch(), unixepoch() + 31536000, 'ACTIVE', unixepoch(), unixepoch()
);

-- Gym Owner (belongs to gym 1)
-- password: admin123
-- SHA-256('admin123') = 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
-- Stored as legacy `sha256$<hex>`. AuthService lazily rehashes to Argon2id
-- on the first successful login.
-- is_owner = 1 marks the primary gym owner (the only one with full permissions).
INSERT OR IGNORE INTO users (id, gym_id, name, email, phone, password_hash, password_algo, role, status, permissions, is_owner, created_at, updated_at)
VALUES
(1, 1, 'Vikram Rathore', 'admin@ironhouse.in', '9876543210',
   'sha256$240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'sha256',
   'OWNER', 'ACTIVE', '{}', 1, unixepoch(), unixepoch());

-- Owner has ALL menu permissions (granted to themselves)
INSERT OR IGNORE INTO user_permissions (user_id, permission_key, granted_by, granted_at) VALUES
(1, 'dashboard', 1, unixepoch()),
(1, 'members',    1, unixepoch()),
(1, 'attendance',  1, unixepoch()),
(1, 'payments',   1, unixepoch()),
(1, 'pt_collections', 1, unixepoch()),
(1, 'plans',     1, unixepoch()),
(1, 'staff',     1, unixepoch()),
(1, 'reports',   1, unixepoch()),
(1, 'settings',  1, unixepoch()),
(1, 'audit_logs',1, unixepoch());

-- Gym Membership Plans
INSERT OR IGNORE INTO membership_plans (id, gym_id, name, description, duration_months, price_paise, admission_fee_paise, tax_percentage, is_active, created_at, updated_at)
VALUES
(1, 1, 'Monthly General Fitness', 'Standard access to gym floor and weights', 1, 150000, 50000, 0, 1, unixepoch(), unixepoch()),
(2, 1, 'Quarterly Strength & Cardio', 'Includes cardio zone and standard strength machines', 3, 400000, 50000, 0, 1, unixepoch(), unixepoch()),
(3, 1, 'Half-Yearly Transform', '6 months all-inclusive access with locker', 6, 750000, 0, 0, 1, unixepoch(), unixepoch()),
(4, 1, 'Annual VIP Pass', 'Full year access + personal trainer consultation', 12, 1400000, 0, 0, 1, unixepoch(), unixepoch());

-- Demo Members
INSERT OR IGNORE INTO members (id, gym_id, member_code, first_name, last_name, email, phone, gender, joined_date, status, created_at, updated_at)
VALUES
(1001, 1, 'MEM-1001', 'Rahul', 'Sharma', 'rahul@example.com', '9876543210', 'MALE', unixepoch() - 7776000, 'ACTIVE', unixepoch(), unixepoch()),
(1002, 1, 'MEM-1002', 'Sneha', 'Reddy', 'sneha@example.com', '9876543211', 'FEMALE', unixepoch() - 5184000, 'ACTIVE', unixepoch(), unixepoch()),
(1003, 1, 'MEM-1003', 'Amit', 'Patel', 'amit@example.com', '9876543212', 'MALE', unixepoch() - 2592000, 'ACTIVE', unixepoch(), unixepoch()),
(1004, 1, 'MEM-1004', 'Priya', 'Nair', 'priya@example.com', '9876543213', 'FEMALE', unixepoch() - 1296000, 'ACTIVE', unixepoch(), unixepoch()),
(1005, 1, 'MEM-1005', 'Rohan', 'Gupta', 'rohan@example.com', '9876543214', 'MALE', unixepoch() - 86400, 'ACTIVE', unixepoch(), unixepoch());

-- Active Memberships for Members
INSERT OR IGNORE INTO memberships (
    id, gym_id, member_id, membership_plan_id, start_date, end_date,
    total_amount_paise, discount_paise, final_amount_paise,
    paid_amount_paise, due_amount_paise, status,
    created_by_user_id, created_at, updated_at
) VALUES
(1001, 1, 1001, 3, unixepoch() - 2592000, unixepoch() + 12960000, 750000, 50000, 700000, 700000, 0, 'ACTIVE', 1, unixepoch(), unixepoch()),
(1002, 1, 1002, 2, unixepoch() - 5184000, unixepoch() + 2592000, 450000, 0, 450000, 300000, 150000, 'ACTIVE', 1, unixepoch(), unixepoch()),
(1003, 1, 1003, 1, unixepoch() - 2000000, unixepoch() + 592000, 200000, 0, 200000, 200000, 0, 'ACTIVE', 1, unixepoch(), unixepoch()),
(1004, 1, 1004, 4, unixepoch() - 1296000, unixepoch() + 30240000, 1400000, 100000, 1300000, 1300000, 0, 'ACTIVE', 1, unixepoch(), unixepoch()),
(1005, 1, 1005, 2, unixepoch() - 86400, unixepoch() + 7689600, 450000, 0, 450000, 450000, 0, 'ACTIVE', 1, unixepoch(), unixepoch());

-- Demo Payments
INSERT OR IGNORE INTO payments (id, gym_id, member_id, membership_id, payment_type, receipt_number, amount_paise, payment_date, payment_mode, reference_id, status, recorded_by_user_id, created_at, updated_at)
VALUES
(1001, 1, 1001, 1001, 'GYM', 'RCP-2026-0001', 700000, unixepoch() - 2592000, 'UPI', 'UPI/202601/1001', 'COMPLETED', 1, unixepoch(), unixepoch()),
(1002, 1, 1002, 1002, 'GYM', 'RCP-2026-0002', 300000, unixepoch() - 5184000, 'CASH', NULL, 'COMPLETED', 1, unixepoch(), unixepoch()),
(1003, 1, 1003, 1003, 'GYM', 'RCP-2026-0003', 200000, unixepoch() - 2000000, 'CARD', 'POS-9831', 'COMPLETED', 2, unixepoch(), unixepoch()),
(1004, 1, 1004, 1004, 'GYM', 'RCP-2026-0004', 1300000, unixepoch() - 1296000, 'UPI', 'UPI/202602/4482', 'COMPLETED', 1, unixepoch(), unixepoch()),
(1005, 1, 1005, 1005, 'GYM', 'RCP-2026-0005', 450000, unixepoch() - 86400, 'UPI', 'UPI/202602/7719', 'COMPLETED', 1, unixepoch(), unixepoch());

-- Demo Today Attendance
INSERT OR IGNORE INTO attendance (id, gym_id, member_id, check_in_time, attendance_date, method, recorded_by_user_id, created_at)
VALUES
(1001, 1, 1001, unixepoch() - 14400, CAST(strftime('%Y%m%d', 'now') AS INTEGER), 'QR', 2, unixepoch()),
(1002, 1, 1002, unixepoch() - 10800, CAST(strftime('%Y%m%d', 'now') AS INTEGER), 'MANUAL', 2, unixepoch()),
(1003, 1, 1004, unixepoch() - 7200, CAST(strftime('%Y%m%d', 'now') AS INTEGER), 'MANUAL', 2, unixepoch());

-- Demo PT Collection
INSERT OR IGNORE INTO pt_collections (id, gym_id, member_id, trainer_id, sessions, amount_paise, commission_percentage, commission_paise, commission_status, payment_mode, payment_date, receipt_number, notes, recorded_by_user_id, created_at, updated_at)
VALUES
(1001, 1, 1004, 3, 12, 1200000, 30, 360000, 'PENDING', 'UPI', unixepoch() - 432000, 'RCP-2026-0006', '12-session PT package', 1, unixepoch(), unixepoch());
