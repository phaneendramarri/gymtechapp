import { test, expect } from '@playwright/test';
import { createMember, isolatedContext, OWNER_STATE, ADMIN_STATE } from './helpers';

// Entire-application pass, part 2: every module renders and its core action
// works — one owner sweep across all sidebar pages, plus the permission
// matrix (restricted staff bounced everywhere except granted menus), plus
// platform admin and the member portal tabs.
test.describe('Entire app sweep (live)', () => {
  test('every gym module renders and core actions work', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      // Dashboard with all tabs.
      await page.goto('/dashboard');
      await expect(page.getByText('Total Revenue (MTD)')).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /live floor/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /renewals/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /transactions/i })).toBeVisible();

      // Members directory.
      await page.goto('/members');
      await expect(page.getByPlaceholder(/search by name/i)).toBeVisible({ timeout: 30000 });

      // Attendance tabs.
      await page.goto('/attendance');
      await expect(page.getByPlaceholder(/search member name/i)).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole('tab', { name: /manual/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /qr scan/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /face id/i })).toBeVisible();

      // Kiosk.
      await page.goto('/kiosk');
      await expect(page.getByText('Self Check-In Kiosk')).toBeVisible({ timeout: 30000 });

      // Classes.
      await page.goto('/classes');
      await expect(page.getByText('Class Schedules & Timetable')).toBeVisible({ timeout: 30000 });

      // Payments ledger + validation (zero rejected, dialog stays).
      await page.goto('/payments');
      await expect(page.getByText("Today's Collection")).toBeVisible({ timeout: 30000 });
      await page.getByRole('button', { name: /collect payment/i }).click();
      await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible({ timeout: 20000 });
      await page.fill('#amount', '0');
      await page.getByRole('button', { name: /^record payment$/i }).click();
      await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible({ timeout: 10000 });
      await page.keyboard.press('Escape');

      // POS + expenses + lockers + PT + plans render.
      await page.goto('/pos');
      await expect(page.getByText(/pos|store|retail|product/i).first()).toBeVisible({ timeout: 30000 });
      await page.goto('/expenses');
      await expect(page.getByText(/expense|p&l|profit/i).first()).toBeVisible({ timeout: 30000 });
      await page.goto('/lockers');
      await expect(page.getByText(/locker/i).first()).toBeVisible({ timeout: 30000 });
      await page.goto('/pt-collections');
      await expect(page.getByText(/pt|commission|collection/i).first()).toBeVisible({ timeout: 30000 });
      await page.goto('/plans');
      await expect(page.getByText('Monthly General').first()).toBeVisible({ timeout: 30000 });

      // Staff + roles tabs.
      await page.goto('/staff');
      await expect(page.getByText('Gym Owner').first()).toBeVisible({ timeout: 30000 });
      await page.getByRole('tab', { name: /roles & menus/i }).click();
      await expect(page.getByRole('button', { name: /create role/i })).toBeVisible({ timeout: 30000 });

      // Reports tabs + audit logs + settings tabs.
      await page.goto('/reports');
      await expect(page.getByText(/revenue|financial/i).first()).toBeVisible({ timeout: 30000 });
      await page.goto('/audit-logs');
      await expect(page.getByText(/audit/i).first()).toBeVisible({ timeout: 30000 });
      await page.goto('/settings');
      await expect(page.getByText(/gym|profile|setting/i).first()).toBeVisible({ timeout: 30000 });

      // Signed-out users bounce to login from a protected page.
      const anon = await isolatedContext(browser);
      try {
        await anon.page.goto('/dashboard');
        await expect(anon.page).toHaveURL(/\/login/, { timeout: 30000 });
        await anon.page.goto('/settings');
        await expect(anon.page).toHaveURL(/\/login/, { timeout: 30000 });
      } finally {
        await anon.context.close();
      }
    } finally {
      await context.close();
    }
  });

  test('permission matrix: restricted staff is bounced off ungranted modules', async ({ browser }) => {
    const suffix = Date.now().toString().slice(-5);
    const roleName = `E2E Sweep ${suffix}`;
    const staffEmail = `e2e.sweep.${suffix}@gym.test`.toLowerCase();
    const staffPass = 'SweepPass123!';

    const owner = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      await owner.page.goto('/staff');
      await expect(owner.page.getByText('Gym Owner').first()).toBeVisible({ timeout: 30000 });
      await owner.page.getByRole('tab', { name: /roles & menus/i }).click();
      await owner.page.getByRole('button', { name: /create role/i }).click();
      await owner.page.getByPlaceholder(/front desk/i).fill(roleName);
      const membersMenu = owner.page.locator('label', { hasText: 'Members Directory' }).first();
      await membersMenu.locator('input[type="checkbox"]').check();
      await owner.page.getByRole('button', { name: /^create role$/i }).click();
      await expect(owner.page.getByText(roleName).first()).toBeVisible({ timeout: 30000 });

      await owner.page.getByRole('tab', { name: /team members/i }).click();
      await owner.page.getByRole('button', { name: /invite user/i }).click();
      await owner.page.getByPlaceholder(/ramesh patel/i).fill(`E2E Sweep ${suffix}`);
      await owner.page.getByPlaceholder('ramesh@gym.com').fill(staffEmail);
      await owner.page.getByPlaceholder('9876543210').fill(`8${suffix}12345`.slice(0, 10));
      await owner.page.getByPlaceholder('Min. 6 characters').fill(staffPass);
      const roleSelect = owner.page.getByRole('dialog').locator('select');
      const readRoleValue = () => roleSelect.evaluate((el: HTMLSelectElement, nm: string) => {
        const opt = Array.from(el.options).find((o) => o.text.includes(nm));
        return opt ? opt.value : '';
      }, roleName);
      await expect(async () => {
        expect(await readRoleValue()).not.toBe('');
      }).toPass({ timeout: 30000 });
      await roleSelect.selectOption(await readRoleValue());
      await owner.page.getByRole('button', { name: /^invite user$/i }).click();
      await expect(owner.page.getByText(staffEmail).first()).toBeVisible({ timeout: 30000 });
    } finally {
      await owner.context.close();
    }

    const staff = await isolatedContext(browser);
    try {
      await staff.page.goto('/login');
      await staff.page.fill('#email', staffEmail);
      await staff.page.fill('#password', staffPass);
      await staff.page.click('button[type="submit"]');
      await expect(staff.page).toHaveURL(/\/dashboard/, { timeout: 45000 });

      // Granted: members directory works.
      await staff.page.goto('/members');
      await expect(staff.page.getByPlaceholder(/search by name/i)).toBeVisible({ timeout: 30000 });

      // Denied: everything else bounces to dashboard.
      for (const denied of ['/payments', '/reports', '/settings', '/staff', '/admin']) {
        await staff.page.goto(denied);
        await expect(staff.page).toHaveURL(/\/dashboard/, { timeout: 30000 });
      }
    } finally {
      await staff.context.close();
    }
  });

  test('platform console and member portal tabs', async ({ browser }) => {
    const admin = await isolatedContext(browser, { storageState: ADMIN_STATE });
    try {
      await admin.page.goto('/admin');
      await expect(admin.page.getByText('GymTech Fitness Club').first()).toBeVisible({ timeout: 30000 });
      await admin.page.getByRole('tab', { name: /gateway/i }).click();
      await expect(admin.page.getByText('Central Communication Gateways')).toBeVisible({ timeout: 30000 });
      await admin.page.getByRole('tab', { name: /audit/i }).click();
      await expect(admin.page.getByText(/gym\.create|platform/i).first()).toBeVisible({ timeout: 30000 });

      await admin.page.goto('/platform/roles');
      await expect(admin.page.getByText(/role/i).first()).toBeVisible({ timeout: 30000 });
      await admin.page.goto('/platform/users');
      await expect(admin.page.getByText(/user|admin/i).first()).toBeVisible({ timeout: 30000 });
    } finally {
      await admin.context.close();
    }

    // Member portal: plan and tabs for a member enrolled by this test.
    const owner = await isolatedContext(browser, { storageState: OWNER_STATE });
    let portalMember: Awaited<ReturnType<typeof createMember>>;
    try {
      portalMember = await createMember(owner.context, { firstName: `Sweep${Date.now().toString().slice(-5)}` });
    } finally {
      await owner.context.close();
    }

    const member = await isolatedContext(browser);
    try {
      await member.page.goto('/login');
      await member.page.getByRole('tab', { name: /^member$/i }).click();
      await member.page.fill('#gymSlug', 'gymtech-club');
      await member.page.fill('#memberIdentifier', portalMember.phone);
      await member.page.fill('#memberCode', portalMember.memberCode);
      await member.page.click('button[type="submit"]');
      await expect(member.page).toHaveURL(/\/portal/, { timeout: 45000 });
      await expect(member.page.getByText(portalMember.firstName).first()).toBeVisible({ timeout: 30000 });
      await expect(member.page.getByText('Monthly General').first()).toBeVisible({ timeout: 30000 });
    } finally {
      await member.context.close();
    }
  });
});
