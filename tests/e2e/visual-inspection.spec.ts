import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Visual Inspection Pass', () => {
  const artifactDir =
    process.env.ARTIFACT_DIR ||
    path.resolve(process.cwd(), 'test-results/visual');

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('gym_token', 'mock-valid-token');
      localStorage.setItem(
        'gym_user',
        JSON.stringify({
          id: 'usr_owner',
          name: 'Vikram Rathore',
          email: 'admin@ironhouse.in',
          role: 'OWNER',
          gymId: 'gym_ironhouse',
        })
      );
      localStorage.setItem(
        'gym_info',
        JSON.stringify({
          id: 'gym_ironhouse',
          name: 'Iron House Fitness',
          status: 'ACTIVE',
        })
      );
    });

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'usr_owner',
            name: 'Vikram Rathore',
            email: 'admin@ironhouse.in',
            role: 'OWNER',
            gymId: 'gym_ironhouse',
          },
          gym: {
            id: 'gym_ironhouse',
            name: 'Iron House Fitness',
            status: 'ACTIVE',
          },
        }),
      });
    });

    await page.route('**/api/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          activeMembers: 142,
          todayAttendance: 28,
          monthlyRevenue: 4500000,
          pendingDues: 150000,
          weeklyAttendance: [
            { day: 'Mon', count: 42 },
            { day: 'Tue', count: 48 },
            { day: 'Wed', count: 38 },
            { day: 'Thu', count: 52 },
            { day: 'Fri', count: 45 },
            { day: 'Sat', count: 60 },
            { day: 'Sun', count: 30 },
          ],
          monthlyRevenueTrend: [
            { month: 'May', revenue: 38000 },
            { month: 'Jun', revenue: 42000 },
            { month: 'Jul', revenue: 45000 },
          ],
          planDistribution: [
            { name: 'Annual Pro', count: 58 },
            { name: 'Quarterly', count: 44 },
            { name: 'Monthly Basic', count: 40 },
          ],
          atRiskMembers: [
            { id: 'mem_1', name: 'Rahul Verma', phone: '9876543201', daysAbsent: 14, planName: 'Annual Pro' },
            { id: 'mem_2', name: 'Priya Sharma', phone: '9876543202', daysAbsent: 19, planName: 'Monthly Basic' },
          ],
          expiringSoon: [
            { id: 'mem_3', name: 'Sneha Reddy', phone: '9876543203', daysRemaining: 3, planName: 'Quarterly' },
          ],
          recentPayments: [
            {
              id: 'pay_1',
              first_name: 'Anand',
              last_name: 'Kumar',
              payment_mode: 'UPI',
              amount: 250000,
              payment_date: Math.floor(Date.now() / 1000) - 3600,
              receipt_number: 'RCP-2026-0001',
              whatsapp_url: 'https://wa.me/919876543299',
            },
          ],
        }),
      });
    });

    await page.route('**/api/members*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          members: [
            {
              id: 'mem_1',
              member_code: 'MEM-1001',
              first_name: 'Rahul',
              last_name: 'Sharma',
              phone: '9876543210',
              email: 'rahul@example.com',
              status: 'ACTIVE',
              plan_name: 'Annual Strength Pro',
              membership_start_date: Math.floor(Date.now() / 1000) - 86400 * 30,
              membership_end_date: Math.floor(Date.now() / 1000) + 86400 * 335,
              membership_due_amount: 0,
            },
            {
              id: 'mem_2',
              member_code: 'MEM-1002',
              first_name: 'Pooja',
              last_name: 'Mehta',
              phone: '9876543211',
              email: 'pooja@example.com',
              status: 'EXPIRED',
              plan_name: 'Monthly Standard',
              membership_start_date: Math.floor(Date.now() / 1000) - 86400 * 60,
              membership_end_date: Math.floor(Date.now() / 1000) - 86400 * 5,
              membership_due_amount: 150000,
            },
          ],
        }),
      });
    });

    await page.route('**/api/payments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          payments: [
            {
              id: 'pay_1',
              receipt_number: 'RCP-2026-0001',
              payment_date: Math.floor(Date.now() / 1000) - 1800,
              first_name: 'Rahul',
              last_name: 'Sharma',
              member_code: 'MEM-1001',
              phone: '9876543210',
              payment_mode: 'UPI',
              reference_id: 'UPI9847291039',
              amount: 1500000,
              whatsapp_url: 'https://wa.me/919876543210',
            },
          ],
          summary: {
            monthlyRevenue: 4500000,
            todayRevenue: 1500000,
            pendingDues: 150000,
          },
        }),
      });
    });

    await page.route('**/api/attendance*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logs: [
            {
              id: 'att_1',
              member_id: 'mem_1',
              first_name: 'Rahul',
              last_name: 'Sharma',
              member_code: 'MEM-1001',
              phone: '9876543210',
              method: 'MANUAL',
              check_in_time: Math.floor(Date.now() / 1000) - 900,
            },
          ],
        }),
      });
    });

    await page.route('**/api/plans*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plans: [
            {
              id: 'plan_1',
              name: 'Annual Strength Pro',
              duration_months: 12,
              price: 1800000,
              admission_fee: 50000,
              description: 'Full access to gym floor, locker, and 2 free PT sessions.',
            },
            {
              id: 'plan_2',
              name: 'Quarterly Fitness',
              duration_months: 3,
              price: 550000,
              admission_fee: 50000,
              description: 'All-access floor pass for 90 days.',
            },
          ],
        }),
      });
    });

    await page.route('**/api/staff*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          staff: [
            {
              id: 'usr_owner',
              name: 'Vikram Rathore',
              email: 'admin@ironhouse.in',
              phone: '9876543210',
              role: 'OWNER',
              status: 'ACTIVE',
              created_at: Math.floor(Date.now() / 1000) - 86400 * 100,
            },
            {
              id: 'usr_mgr',
              name: 'Kavita Sen',
              email: 'kavita@ironhouse.in',
              phone: '9876543212',
              role: 'MANAGER',
              status: 'ACTIVE',
              created_at: Math.floor(Date.now() / 1000) - 86400 * 30,
            },
            {
              id: 'usr_trainer',
              name: 'Arjun Singh',
              email: 'arjun@ironhouse.in',
              phone: '9876543213',
              role: 'TRAINER',
              status: 'ACTIVE',
              created_at: Math.floor(Date.now() / 1000) - 86400 * 20,
            },
          ],
        }),
      });
    });
  });

  test('captures screenshots of major application screens', async ({ page }) => {
    test.setTimeout(60000);
    // Landing Page Screenshot (Light)
    await page.goto('/#/');
    await expect(page.getByRole('banner')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(artifactDir, 'screen_landing.png'), fullPage: true });

    // Landing Page Screenshot (Dark)
    const landingThemeBtn = page.getByRole('button', { name: /toggle theme/i }).first();
    if (await landingThemeBtn.isVisible()) {
      await landingThemeBtn.click();
      await page.waitForTimeout(300);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(artifactDir, 'screen_landing_dark.png'), fullPage: true });
      // Switch back to light
      await landingThemeBtn.click();
      await page.waitForTimeout(200);
    }

    // Dashboard Screenshot
    await page.goto('/#/dashboard');
    await expect(page.getByText(/Iron House Fitness/i).first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifactDir, 'screen_dashboard.png'), fullPage: true });

    // Members Directory Screenshot
    await page.goto('/#/members');
    await expect(page.getByText('Rahul Sharma').first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifactDir, 'screen_members.png'), fullPage: true });

    // Payments & Dues Ledger Screenshot
    await page.goto('/#/payments');
    await expect(page.getByText('RCP-2026-0001').first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifactDir, 'screen_payments.png'), fullPage: true });

    // Attendance & Kiosk Terminal Screenshot
    await page.goto('/#/attendance');
    await expect(page.getByText('Fast Check-In Terminal').first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifactDir, 'screen_attendance.png'), fullPage: true });

    // Plans Catalog Screenshot
    await page.goto('/#/plans');
    await expect(page.getByText('Annual Strength Pro').first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifactDir, 'screen_plans.png'), fullPage: true });

    // Staff & Team Access Screenshot
    await page.goto('/#/staff');
    await expect(page.getByText('Vikram Rathore').first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifactDir, 'screen_staff.png'), fullPage: true });

    // Notification & SMTP Configurable Block Screenshot
    await page.goto('/#/settings/notifications');
    await expect(page.getByText(/Email Delivery & Sender Account/i).first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifactDir, 'screen_smtp_settings.png'), fullPage: true });

    // Dark Mode Toggle & Screenshot
    const themeBtn = page.getByRole('button', { name: /toggle theme/i });
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(artifactDir, 'screen_staff_dark.png'), fullPage: true });
    }
  });
});
