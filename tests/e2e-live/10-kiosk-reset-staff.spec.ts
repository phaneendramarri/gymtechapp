import { test, expect } from '@playwright/test';
import { createMember, isolatedContext, OWNER_STATE } from './helpers';

test.describe('Kiosk (live)', () => {
  test('self check-in via the touch keypad (KIOSK method)', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      // Enroll the member who walks up to the kiosk, then type their numeric
      // id on the touch keypad (codes with letters cannot be typed there).
      const member = await createMember(context, { firstName: `Kiosk${Date.now().toString().slice(-5)}` });

      await page.goto('/kiosk');
      await expect(page.getByText('Self Check-In Kiosk')).toBeVisible({ timeout: 30000 });
      for (const digit of String(member.id)) {
        await page.getByRole('button', { name: digit, exact: true }).click();
      }
      await page.getByRole('button', { name: /check in now/i }).click();
      // SUCCESS welcome (or a membership notice) — both prove the KIOSK
      // check-in method round-trips through the DB constraint. The card
      // auto-resets after 4s, so assert promptly.
      await expect(page.getByText(new RegExp(`welcome, ${member.firstName}`, 'i')).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(member.memberCode).first()).toBeVisible({ timeout: 5000 });
    } finally {
      await context.close();
    }
  });
});

test.describe('Staff lifecycle + password reset (live)', () => {
  test('deactivates staff, resets their password, and they sign back in', async ({ browser }) => {
    const suffix = Date.now().toString().slice(-5);
    const email = `e2e.lifecycle.${suffix}@gym.test`.toLowerCase();
    const origPass = 'OrigPass123!';
    const newPass = 'NewPass456!';

    // ---- Create staff via API (owner session) ----
    const owner = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      const csrf = (await owner.context.cookies()).find((c) => c.name === 'gym_csrf')?.value ?? '';
      const res = await owner.page.request.post('/api/staff', {
        headers: csrf ? { 'X-CSRF-Token': csrf } : {},
        data: {
          name: `E2E Lifecycle ${suffix}`, email,
          phone: `7${suffix}03030`.slice(0, 10), password: origPass,
        },
      });
      if (!res.ok()) throw new Error(`staff create failed: ${res.status()} ${await res.text()}`);
    } finally {
      await owner.context.close();
    }

    // ---- Owner deactivates them; login is refused ----
    const mgr = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      await mgr.page.goto('/staff');
      await expect(mgr.page.getByText(email).first()).toBeVisible({ timeout: 30000 });
      const row = mgr.page.locator('li', { hasText: email }).first();
      await row.getByRole('button', { name: /deactivate/i }).click();
      await expect(mgr.page.getByText(/deactivated|disabled/i).first()).toBeVisible({ timeout: 30000 });
    } finally {
      await mgr.context.close();
    }

    const blocked = await isolatedContext(browser);
    try {
      await blocked.page.goto('/login');
      await blocked.page.fill('#email', email);
      await blocked.page.fill('#password', origPass);
      await blocked.page.click('button[type="submit"]');
      await expect(blocked.page).toHaveURL(/\/login/);
      // Disabled accounts get an explicit (non-generic) message.
      await expect(blocked.page.getByText(/deactivated or suspended/i).first())
        .toBeVisible({ timeout: 30000 });
    } finally {
      await blocked.context.close();
    }

    // ---- Owner reactivates; forgot-password issues a dev reset link ----
    const mgr2 = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      await mgr2.page.goto('/staff');
      await expect(mgr2.page.getByText(email).first()).toBeVisible({ timeout: 30000 });
      const row = mgr2.page.locator('li', { hasText: email }).first();
      const toggle = row.getByRole('button', { name: /activate|enable/i });
      if ((await toggle.count()) > 0) await toggle.first().click();
    } finally {
      await mgr2.context.close();
    }

    const forgot = await isolatedContext(browser);
    let resetUrl: string | null = null;
    try {
      await forgot.page.goto('/login');
      await forgot.page.getByRole('button', { name: /forgot password/i }).click();
      await forgot.page.fill('#forgotEmail', email);
      await forgot.page.getByRole('button', { name: /send reset link/i }).click();
      await expect(forgot.page.getByText(/reset link|sent to your email/i).first())
        .toBeVisible({ timeout: 30000 });
      const devLink = forgot.page.getByRole('link', { name: /reset/i }).first();
      if ((await devLink.count()) > 0) resetUrl = await devLink.getAttribute('href');
    } finally {
      await forgot.context.close();
    }
    if (!resetUrl) throw new Error('dev reset URL was not issued (check APP_ENV)');

    // ---- Reset and sign in with the new password ----
    const reset = await isolatedContext(browser);
    try {
      await reset.page.goto(resetUrl);
      await reset.page.fill('#newPassword', newPass);
      await reset.page.fill('#confirmPassword', newPass);
      await reset.page.click('button[type="submit"]');
      await expect(reset.page.getByText(/success|updated|reset/i).first()).toBeVisible({ timeout: 30000 });

      await reset.page.goto('/login');
      await reset.page.fill('#email', email);
      await reset.page.fill('#password', newPass);
      await reset.page.click('button[type="submit"]');
      await expect(reset.page).toHaveURL(/\/dashboard/, { timeout: 45000 });
    } finally {
      await reset.context.close();
    }
  });
});
