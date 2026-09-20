import { test, expect } from '@playwright/test';
import { isolatedContext } from './helpers';

// Unauthenticated browser — validation, failure cases, real login/logout.
// Every test gets its own client IP so the 5/min auth budget never leaks
// across tests.
test.describe('Auth (live)', () => {
  test('login page renders with staff/member modes', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser);
    try {
      await page.goto('/login');
      await expect(page.getByText('Sign in to your console')).toBeVisible();
      await expect(page.locator('#email')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
      await page.getByRole('tab', { name: /member/i }).click();
      await expect(page.getByText('Open your member pass')).toBeVisible();
      await expect(page.locator('#gymSlug')).toBeVisible();
      await expect(page.locator('#memberIdentifier')).toBeVisible();
      await expect(page.locator('#memberCode')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('wrong password shows an error and stays on login', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser);
    try {
      await page.goto('/login');
      await page.fill('#email', 'owner@gymtech.app');
      await page.fill('#password', 'WrongPassword999!');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByText('Invalid email or password').first())
        .toBeVisible({ timeout: 30000 });
    } finally {
      await context.close();
    }
  });

  test('unknown email is rejected with the same generic error', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser);
    try {
      await page.goto('/login');
      await page.fill('#email', 'nobody@nowhere.example');
      await page.fill('#password', 'Password123!');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/login/);
      // Identical message — the UI must not reveal whether the email exists.
      await expect(page.getByText('Invalid email or password').first())
        .toBeVisible({ timeout: 30000 });
    } finally {
      await context.close();
    }
  });

  test('protected routes redirect to login when signed out', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser);
    try {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login/, { timeout: 30000 });
      await page.goto('/members');
      await expect(page).toHaveURL(/\/login/, { timeout: 30000 });
    } finally {
      await context.close();
    }
  });

  test('owner login lands on dashboard and survives refresh', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser);
    try {
      await page.goto('/login');
      await page.fill('#email', 'owner@gymtech.app');
      await page.fill('#password', 'Password123!');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 });
      await page.reload();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 });
    } finally {
      await context.close();
    }
  });
});
