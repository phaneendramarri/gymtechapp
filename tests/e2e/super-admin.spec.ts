import { test, expect } from '@playwright/test';

test.describe('Gym SaaS — Super Admin Portal', () => {
  test.beforeEach(async ({ page }) => {
    // Setup Super Admin session
    await page.addInitScript(() => {
      localStorage.setItem('gym_token', 'mock-superadmin-token');
      localStorage.setItem(
        'gym_user',
        JSON.stringify({
          id: 'usr_superadmin',
          name: 'Platform Super Admin',
          email: 'superadmin@gymtech.app',
          role: 'SUPER_ADMIN',
          gymId: null,
        })
      );
    });

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'usr_superadmin',
            name: 'Platform Super Admin',
            email: 'superadmin@gymtech.app',
            role: 'SUPER_ADMIN',
            gymId: null,
          },
          gym: null,
        }),
      });
    });

    await page.route('**/api/admin/metrics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalGyms: 14,
          activeGyms: 12,
          totalMembers: 1850,
          platformRevenue: 12400000,
        }),
      });
    });

    await page.route('**/api/admin/plans', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plans: [
            { id: 'plan_pro', name: 'Professional', price_monthly: 199900, max_members: 500 },
          ],
        }),
      });
    });

    await page.route('**/api/admin/gyms*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            gymId: 'gym_new_123',
            userId: 'usr_new_123',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          gyms: [
            {
              id: 'gym_ironhouse',
              name: 'Iron House Fitness',
              city: 'Hyderabad',
              phone: '9876543210',
              plan_name: 'Professional',
              member_count: 142,
              max_members: 500,
              status: 'ACTIVE',
            },
          ],
        }),
      });
    });
  });

  test('loads Super Admin portal and views platform metrics and tenant gyms', async ({ page }) => {
    await page.goto('/#/admin');

    await expect(page.getByText('Platform Administration')).toBeVisible();
    await expect(page.getByText('14').first()).toBeVisible(); // Total gyms
    await expect(page.getByText('Iron House Fitness')).toBeVisible();
    await expect(page.getByText('Hyderabad • 9876543210')).toBeVisible();

    // Verify Suspend button is rendered
    await expect(page.getByRole('button', { name: /Suspend/i })).toBeVisible();
  });

  test('provisions a new gym and owner account via wizard', async ({ page }) => {
    await page.goto('/#/admin');

    await page.fill('#gName', 'Metro Fitness Club');
    await page.fill('#gPhone', '9876500000');
    await page.fill('#oName', 'Suresh Reddy');
    await page.fill('#oEmail', 'suresh@metrofit.in');
    await page.fill('#oPhone', '9876500001');

    await page.click('button[type="submit"]');

    // Password is auto-generated when left blank; success banner + credentials are shown
    await expect(page.getByText(/New gym onboarded/i)).toBeVisible();
    await expect(page.getByText(/suresh@metrofit\.in/)).toBeVisible();
  });
});
