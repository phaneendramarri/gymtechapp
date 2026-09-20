import { test, expect } from '@playwright/test';
import { isolatedContext, OWNER_STATE } from './helpers';

test.describe('Staff & roles (live)', () => {
  test('creates a members-only role, invites staff, and enforces the boundary', async ({ browser }) => {
    const suffix = Date.now().toString().slice(-5);
    const roleName = `E2E Desk ${suffix}`;
    const staffEmail = `e2e.desk.${suffix}@gym.test`.toLowerCase();
    const staffPass = 'DeskPass123!';

    // ---- Owner creates the role ----
    const owner = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      await owner.page.goto('/staff');
      await expect(owner.page.getByText('Gym Owner').first()).toBeVisible({ timeout: 30000 });
      // Role management lives on the Roles & Menus tab.
      await owner.page.getByRole('tab', { name: /roles & menus/i }).click();
      await owner.page.getByRole('button', { name: /create role/i }).click();
      await owner.page.getByPlaceholder(/front desk/i).fill(roleName);
      // Grant only the Members Directory menu.
      const membersMenu = owner.page.locator('label', { hasText: 'Members Directory' }).first();
      await membersMenu.locator('input[type="checkbox"]').check();
      await owner.page.getByRole('button', { name: /^create role$/i }).click();
      await expect(owner.page.getByText(roleName).first()).toBeVisible({ timeout: 30000 });

      // ---- Owner invites staff with that role ----
      await owner.page.getByRole('tab', { name: /team members/i }).click();
      await owner.page.getByRole('button', { name: /invite user/i }).click();
      await owner.page.getByPlaceholder(/ramesh patel/i).fill(`E2E Desk ${suffix}`);
      await owner.page.getByPlaceholder('ramesh@gym.com').fill(staffEmail);
      await owner.page.getByPlaceholder('9876543210').fill(`8${suffix}12345`.slice(0, 10));
      await owner.page.getByPlaceholder('Min. 6 characters').fill(staffPass);
      // Scope to the invite dialog — the page has other selects.
      // Poll: the roles query refetches after create-role invalidation,
      // so the option may need a beat to appear in a full sequential run.
      const roleSelect = owner.page.getByRole('dialog').locator('select');
      const readRoleValue = () => roleSelect.evaluate((el: HTMLSelectElement, name: string) => {
        const opt = Array.from(el.options).find((o) => o.text.includes(name));
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

    // ---- Staff can use members but is bounced off payments ----
    const staff = await isolatedContext(browser);
    try {
      await staff.page.goto('/login');
      await staff.page.fill('#email', staffEmail);
      await staff.page.fill('#password', staffPass);
      await staff.page.click('button[type="submit"]');
      await expect(staff.page).toHaveURL(/\/dashboard/, { timeout: 45000 });

      await staff.page.goto('/members');
      await expect(staff.page.getByPlaceholder(/search by name/i)).toBeVisible({ timeout: 30000 });

      await staff.page.goto('/payments');
      await expect(staff.page).toHaveURL(/\/dashboard/, { timeout: 30000 });

      await staff.page.goto('/admin');
      await expect(staff.page).toHaveURL(/\/dashboard/, { timeout: 30000 });
    } finally {
      await staff.context.close();
    }
  });
});
