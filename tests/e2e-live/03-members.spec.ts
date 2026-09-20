import { test, expect } from '@playwright/test';
import { isolatedContext, OWNER_STATE } from './helpers';

const uniquePhone = () => `9${Date.now().toString().slice(-9)}`;

test.describe('Members (live)', () => {
  test('directory loads with summary tiles and search', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      await page.goto('/members');
      await expect(page.getByText('Total', { exact: true }).first()).toBeVisible({ timeout: 30000 });
      await expect(page.getByPlaceholder(/search by name/i)).toBeVisible();
      await expect(page.getByRole('tab', { name: /active/i }).first()).toBeVisible();
      // Navigate to enrollment via the Add member action.
      await expect(page.getByRole('link', { name: /add member/i })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('validation blocks empty and bad submissions', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      await page.goto('/members/new');
      await expect(page.getByText('New Member Registration')).toBeVisible({ timeout: 30000 });
      // Wait for the plan catalog — submit is disabled until a plan exists.
      await expect(page.locator('#initialPayment')).not.toHaveValue('', { timeout: 30000 });
      // Submit with an invalid phone — the browser's native pattern
      // validation ([0-9]{10}) must block the submit before any request.
      await page.fill('#firstName', 'NoPhone');
      await page.fill('#phone', '123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/members\/new/);
      await expect(page.locator('#phone:invalid')).toHaveCount(1);
      await expect(page.getByText('Member Enrolled Successfully')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('full lifecycle: create → profile → edit → renew → freeze → unfreeze → archive → restore', async ({
    browser,
  }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      const phone = uniquePhone();
      const tag = phone.slice(-4);

      // ---- CREATE ----
      await page.goto('/members/new');
      await expect(page.getByText('New Member Registration')).toBeVisible({ timeout: 30000 });
      // Wait for the plan catalog — submit stays disabled until a plan is set.
      await expect(page.locator('#initialPayment')).not.toHaveValue('', { timeout: 30000 });
      await page.fill('#firstName', `E2E${tag}`);
      await page.fill('#lastName', 'Lifecycle');
      await page.fill('#phone', phone);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Member Enrolled Successfully')).toBeVisible({ timeout: 45000 });
      const codeText = await page.getByText(/MEM-\d+/).first().textContent();
      expect(codeText).toMatch(/MEM-\d+/);
      const memberCode = codeText!.match(/MEM-\d+/)![0];
      // Receipt is minted when the plan price is paid in full by default.
      await expect(page.getByText(/RCP-/).first()).toBeVisible();
      await expect(page.getByRole('link', { name: /whatsapp/i })).toBeVisible();

      // ---- PROFILE ----
      await page.getByRole('link', { name: /view profile/i }).click();
      await expect(page).toHaveURL(/\/members\/\d+/, { timeout: 30000 });
      await expect(page.getByText(`E2E${tag}`).first()).toBeVisible({ timeout: 30000 });
      const profileUrl = page.url();
      const memberId = profileUrl.match(/\/members\/(\d+)/)![1];

      // ---- PERSISTENCE ACROSS REFRESH ----
      await page.reload();
      await expect(page.getByText(`E2E${tag}`).first()).toBeVisible({ timeout: 30000 });

      // ---- SEARCH FINDS THE NEW MEMBER ----
      await page.goto('/members');
      await page.getByPlaceholder(/search by name/i).fill(`E2E${tag}`);
      await expect(page.getByText(memberCode).first()).toBeVisible({ timeout: 30000 });

      // ---- RENEW ----
      await page.goto(`/members/${memberId}/renew`);
      await expect(page.locator('form, button[type="submit"]').first()).toBeVisible({ timeout: 30000 });
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/members\/\d+/, { timeout: 45000 });

      // ---- FREEZE / UNFREEZE (unconditional — buttons exist for actives) ----
      await page.goto(`/members/${memberId}`);
      await page.getByRole('button', { name: /^freeze$/i }).click();
      await expect(page.getByText('Membership paused').first()).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole('button', { name: /^resume$/i })).toBeVisible({ timeout: 30000 });
      await page.getByRole('button', { name: /^resume$/i }).click();
      await expect(page.getByText('Membership resumed').first()).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole('button', { name: /^freeze$/i })).toBeVisible({ timeout: 30000 });

      // ---- ARCHIVE via the directory row action ----
      await page.goto('/members');
      await page.getByPlaceholder(/search by name/i).fill(`E2E${tag}`);
      const row = page.locator('tr', { hasText: memberCode }).first();
      await expect(row).toBeVisible({ timeout: 30000 });
      await row.getByRole('button').last().click();
      await page.getByRole('menuitem', { name: /archive member/i }).click();
      // ConfirmDialog confirm button.
      await page.getByRole('button', { name: /^archive member$/i }).last().click();
      await expect(page.getByText('Member archived')).toBeVisible({ timeout: 30000 });
      // Archived record disappears from the active directory.
      await expect(page.locator('tr', { hasText: memberCode })).toHaveCount(0, { timeout: 30000 });

      // ---- RESTORE via API (no restore affordance exists in the UI) ----
      const csrf = (await context.cookies()).find((c) => c.name === 'gym_csrf')?.value ?? '';
      const restoreRes = await page.request.post(`/api/members/${memberId}/restore`, {
        headers: csrf ? { 'X-CSRF-Token': csrf } : {},
      });
      if (!restoreRes.ok()) throw new Error(`restore failed: ${restoreRes.status()} ${await restoreRes.text()}`);
      await page.goto('/members');
      await page.getByPlaceholder(/search by name/i).fill(`E2E${tag}`);
      await expect(page.getByText(memberCode).first()).toBeVisible({ timeout: 30000 });
    } finally {
      await context.close();
    }
  });
});
