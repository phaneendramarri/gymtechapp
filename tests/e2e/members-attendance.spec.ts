import { test, expect } from '@playwright/test';

test.describe('Gym SaaS — Operations & Member Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Setup authenticated session in localStorage
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

    await page.route('**/api/members*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            member: {
              id: 'mem_new_1',
              member_code: 'MEM-1006',
              first_name: 'Anand',
              last_name: 'Kumar',
              phone: '9876543299',
              status: 'ACTIVE',
              joined_date: Math.floor(Date.now() / 1000),
            },
            membership: {
              id: 'ms_new_1',
              status: 'ACTIVE',
            },
            receiptNumber: 'RCP-2026-0009',
            whatsappUrl: 'https://wa.me/919876543299?text=Welcome',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          members: [
            {
              id: 'mem_1001',
              member_code: 'MEM-1001',
              first_name: 'Rahul',
              last_name: 'Sharma',
              phone: '9876543210',
              email: 'rahul@example.com',
              status: 'ACTIVE',
              plan_name: 'Half-Yearly Transform',
              membership_end_date: Math.floor(Date.now() / 1000) + 86400 * 120,
              membership_due_amount: 0,
            },
          ],
        }),
      });
    });

    await page.route('**/api/plans', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plans: [
            {
              id: 'mpl_quarterly',
              name: 'Quarterly Strength',
              duration_months: 3,
              price: 400000,
              admission_fee: 50000,
              is_active: 1,
            },
          ],
        }),
      });
    });

    await page.route('**/api/attendance/check-in', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          alreadyCheckedIn: false,
          member: {
            id: 'mem_1001',
            name: 'Rahul Sharma',
            memberCode: 'MEM-1001',
            phone: '9876543210',
            status: 'ACTIVE',
          },
        }),
      });
    });

    await page.route('**/api/attendance', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logs: [
            {
              id: 'att_1',
              member_id: 'mem_1001',
              first_name: 'Rahul',
              last_name: 'Sharma',
              member_code: 'MEM-1001',
              phone: '9876543210',
              check_in_time: Math.floor(Date.now() / 1000) - 1800,
              date_key: '2026-08-28',
              method: 'MANUAL',
            },
          ],
        }),
      });
    });
  });

  test('displays member directory and searches members', async ({ page }) => {
    await page.goto('/#/members');
    await expect(page.getByText('Enrolled Members')).toBeVisible();
    await expect(page.getByText('Rahul Sharma')).toBeVisible();
    await expect(page.getByText('MEM-1001')).toBeVisible();

    const searchInput = page.getByPlaceholder(/search by name/i);
    await searchInput.fill('Rahul');
    await expect(page.getByText('Rahul Sharma')).toBeVisible();
  });

  test('registers a new member with plan and shows receipt & whatsapp button', async ({ page }) => {
    await page.goto('/#/members/new');
    await expect(page.getByText('New Member Registration')).toBeVisible();

    await page.fill('#firstName', 'Anand');
    await page.fill('#lastName', 'Kumar');
    await page.fill('#phone', '9876543299');
    await page.fill('#initialPayment', '4500');

    await page.click('button[type="submit"]');

    await expect(page.getByText('Member Enrolled Successfully')).toBeVisible();
    await expect(page.getByText('MEM-1006')).toBeVisible();
    await expect(page.getByRole('link', { name: /Send WhatsApp/i })).toBeVisible();
  });

  test('performs attendance desk check-in', async ({ page }) => {
    await page.goto('/#/attendance');
    await expect(page.getByText('Check-in Terminal')).toBeVisible();

    const codeInput = page.locator('#code');
    await codeInput.fill('MEM-1001');
    await page.click('button[type="submit"]');

    await expect(page.getByText(/Welcome, Rahul Sharma/i)).toBeVisible();
    await expect(page.getByText(/MEM-1001/i).first()).toBeVisible();
  });
});
