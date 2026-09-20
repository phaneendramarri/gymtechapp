import { test, expect } from '@playwright/test';
import { isolatedContext, OWNER_STATE } from './helpers';

test.describe('Dashboard (live)', () => {
  test('loads KPIs, tabs and gym context', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      await page.goto('/dashboard');
      await expect(page.getByText('Total Revenue (MTD)')).toBeVisible({ timeout: 30000 });
      await expect(page.getByText('Active Memberships')).toBeVisible();
      await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /live floor/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /renewals/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /transactions/i })).toBeVisible();
      // Gym context is visible in the shell.
      await expect(page.getByText('GymTech Fitness Club').first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('sync button refreshes metrics without error', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      await page.goto('/dashboard');
      await expect(page.getByText('Total Revenue (MTD)')).toBeVisible({ timeout: 30000 });
      await page.getByRole('button', { name: /sync/i }).click();
      await expect(page.getByText('Total Revenue (MTD)')).toBeVisible({ timeout: 30000 });
      await expect(page.getByText(/internal server error|something went wrong/i)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('add-member shortcut navigates to enrollment', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      await page.goto('/dashboard');
      await expect(page.getByText('Total Revenue (MTD)')).toBeVisible({ timeout: 30000 });
      await page.getByRole('link', { name: /add member/i }).click();
      await expect(page).toHaveURL(/\/members\/new/, { timeout: 20000 });
      await expect(page.getByText('New Member Registration')).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
