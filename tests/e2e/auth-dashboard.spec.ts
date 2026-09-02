import { test, expect } from '@playwright/test';

test.describe('Gym SaaS — Auth & Dashboard Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication and dashboard endpoints
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'mock-jwt-token-12345',
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
            slug: 'iron-house-fitness',
            phone: '9876543210',
            status: 'ACTIVE',
          },
        }),
      });
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
          expiringSoon: [
            {
              id: 'mem_1002',
              first_name: 'Sneha',
              last_name: 'Reddy',
              phone: '9876543211',
              plan_name: 'Quarterly Strength',
              end_date: Math.floor(Date.now() / 1000) + 86400 * 3,
              due_amount: 150000,
              whatsapp_url: 'https://wa.me/919876543211?text=Reminder',
            },
          ],
          recentPayments: [
            {
              id: 'pay_1001',
              first_name: 'Rahul',
              last_name: 'Sharma',
              phone: '9876543210',
              payment_mode: 'UPI',
              payment_date: Math.floor(Date.now() / 1000) - 3600,
              amount: 700000,
              receipt_number: 'RCP-2026-0001',
              whatsapp_url: 'https://wa.me/919876543210?text=Receipt',
            },
          ],
        }),
      });
    });
  });

  test('loads landing page and navigates to sign in', async ({ page }) => {
    await page.goto('/#/');
    await expect(page).toHaveTitle(/GymTech/);

    const signInBtn = page.getByRole('banner').getByRole('link', { name: /Sign In/i });
    await expect(signInBtn).toBeVisible();
    await signInBtn.click();

    await expect(page).toHaveURL(/#\/login/);
    await expect(page.getByText('Sign In to GymTech')).toBeVisible();
  });

  test('logs in successfully as gym owner and views dashboard metrics', async ({ page }) => {
    await page.goto('/#/login');

    await page.fill('#email', 'admin@ironhouse.in');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/#\/dashboard/);
    await expect(page.getByText(/Iron House Fitness/i).first()).toBeVisible();

    // Verify KPI metric cards
    await expect(page.getByText('Active members').first()).toBeVisible();
    await expect(page.getByText('142', { exact: true })).toBeVisible();
    await expect(page.getByText("Today's Check-ins").first()).toBeVisible();

    // Verify expiring soon member
    await expect(page.getByText('Sneha Reddy')).toBeVisible();
    await expect(page.getByRole('link', { name: /WhatsApp/i }).first()).toBeVisible();
  });

  test('toggles theme between light and dark mode', async ({ page }) => {
    await page.goto('/#/login');

    const themeToggle = page.getByRole('button', { name: /toggle theme/i });
    await expect(themeToggle).toBeVisible();

    // Toggle theme
    await themeToggle.click();
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).toBe(true);

    await themeToggle.click();
    const isLight = await page.evaluate(() => !document.documentElement.classList.contains('dark'));
    expect(isLight).toBe(true);
  });
});
