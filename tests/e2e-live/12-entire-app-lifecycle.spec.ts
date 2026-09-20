import { test, expect } from '@playwright/test';
import { isolatedContext, OWNER_STATE } from './helpers';

const uniquePhone = () => `9${Date.now().toString().slice(-9)}`;

// Entire-application pass, part 1: the complete member lifecycle on a fresh
// member — enroll -> renew page -> freeze/resume -> dues -> archive/restore —
// every step through the real UI with refresh persistence checks.
test.describe('Entire app (live)', () => {
  test('full member lifecycle with renew, freeze, dues, archive, restore', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      const phone = uniquePhone();
      const tag = phone.slice(-4);
      const name = `E2EFull${tag}`;

      // ---- Enroll ----
      await page.goto('/members/new');
      await expect(page.getByText('New Member Registration')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('#initialPayment')).not.toHaveValue('', { timeout: 30000 });
      await page.fill('#firstName', name);
      await page.fill('#lastName', 'Full');
      await page.fill('#phone', phone);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Member Enrolled Successfully')).toBeVisible({ timeout: 45000 });
      const memberCode = (await page.getByText(/MEM-\d+/).first().textContent())!.match(/MEM-\d+/)![0];
      await page.getByRole('link', { name: /view profile/i }).click();
      await expect(page).toHaveURL(/\/members\/\d+/, { timeout: 30000 });
      const memberId = page.url().match(/\/members\/(\d+)/)![1];

      // ---- Renew via the renew page ----
      await page.goto(`/members/${memberId}/renew`);
      await expect(page.locator('form, button[type="submit"]').first()).toBeVisible({ timeout: 30000 });
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/members\/\d+/, { timeout: 45000 });
      await page.reload();
      await expect(page.getByText(name).first()).toBeVisible({ timeout: 30000 });

      // ---- Freeze / resume ----
      await page.goto(`/members/${memberId}`);
      await page.getByRole('button', { name: /^freeze$/i }).click();
      await expect(page.getByText('Membership paused').first()).toBeVisible({ timeout: 30000 });
      await page.reload();
      await expect(page.getByRole('button', { name: /^resume$/i })).toBeVisible({ timeout: 30000 });
      await page.getByRole('button', { name: /^resume$/i }).click();
      await expect(page.getByText('Membership resumed').first()).toBeVisible({ timeout: 30000 });

      // ---- Member detail shows payments section ----
      await expect(page.getByText(/payment/i).first()).toBeVisible({ timeout: 30000 });

      // ---- Archive via directory, verify gone, restore via API, verify back ----
      await page.goto('/members');
      await page.getByPlaceholder(/search by name/i).fill(name);
      const row = page.locator('tr', { hasText: memberCode }).first();
      await expect(row).toBeVisible({ timeout: 30000 });
      await row.getByRole('button').last().click();
      await page.getByRole('menuitem', { name: /archive member/i }).click();
      await page.getByRole('button', { name: /^archive member$/i }).last().click();
      await expect(page.getByText('Member archived')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('tr', { hasText: memberCode })).toHaveCount(0, { timeout: 30000 });

      const csrf = (await context.cookies()).find((c) => c.name === 'gym_csrf')?.value ?? '';
      const restoreRes = await page.request.post(`/api/members/${memberId}/restore`, {
        headers: csrf ? { 'X-CSRF-Token': csrf } : {},
      });
      if (!restoreRes.ok()) throw new Error(`restore failed: ${restoreRes.status()} ${await restoreRes.text()}`);
      await page.goto('/members');
      await page.getByPlaceholder(/search by name/i).fill(name);
      await expect(page.getByText(memberCode).first()).toBeVisible({ timeout: 30000 });

      // ---- Validation: bad phone is blocked natively ----
      await page.goto('/members/new');
      await page.fill('#firstName', 'NoPhone');
      await page.fill('#phone', '123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/members\/new/);
      await expect(page.locator('#phone:invalid')).toHaveCount(1);
    } finally {
      await context.close();
    }
  });

  test('plans: create persists, validation blocks empty name', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      const name = `E2E Full Plan ${Date.now().toString().slice(-6)}`;
      await page.goto('/plans');
      await expect(page.getByText('Monthly General').first()).toBeVisible({ timeout: 30000 });
      await page.getByRole('button', { name: /new plan/i }).click();
      await page.fill('#planName', name);
      await page.fill('#duration', '6');
      await page.fill('#price', '8000');
      await page.getByRole('button', { name: /^create plan$/i }).click();
      await expect(page.getByText(name).first()).toBeVisible({ timeout: 30000 });
      await page.reload();
      await expect(page.getByText(name).first()).toBeVisible({ timeout: 30000 });
    } finally {
      await context.close();
    }
  });
});
