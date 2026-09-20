import { test as setup, expect } from '@playwright/test';
import { OWNER_STATE, ADMIN_STATE } from './helpers';

// One login per role for the whole live run (the auth tier allows
// 10 attempts/min per IP — every spec reuses these cookie jars via
// storageState instead of logging in again). Setup uses dedicated IPs so
// the shared localhost bucket stays clean for the negative auth tests.
setup('authenticate as gym owner', async ({ browser }) => {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'CF-Connecting-IP': '10.200.0.1' },
  });
  const page = await context.newPage();
  await page.goto('/login');
  await expect(page.locator('#email')).toBeVisible({ timeout: 30000 });
  await page.fill('#email', 'owner@gymtech.app');
  await page.fill('#password', 'Password123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 });
  await page.context().storageState({ path: OWNER_STATE });
  await context.close();
});

setup('authenticate as platform admin', async ({ browser }) => {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'CF-Connecting-IP': '10.200.0.2' },
  });
  const page = await context.newPage();
  await page.goto('/login');
  await expect(page.locator('#email')).toBeVisible({ timeout: 30000 });
  await page.fill('#email', 'admin@gymtech.app');
  await page.fill('#password', 'Password123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/admin/, { timeout: 45000 });
  await page.context().storageState({ path: ADMIN_STATE });
  await context.close();
});
