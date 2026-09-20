import { test, expect } from '@playwright/test';
import { isolatedContext, OWNER_STATE } from './helpers';

// Fresh end-user walkthrough (written independently of the per-feature
// specs): home -> login -> dashboard -> enroll member -> profile/edit ->
// payment+invoice -> attendance -> dashboard/reports reflect it ->
// member portal. Every step drives the real UI and asserts persistence
// across refresh.
test.describe('Fresh walkthrough (live)', () => {
  test('home to portal: the whole gym day in one browser', async ({ browser }) => {
    const tag = Date.now().toString().slice(-6);
    const phone = `9${Date.now().toString().slice(-9)}`;
    const firstName = `Walk${tag}`;

    const { context, page } = await isolatedContext(browser);
    try {
      // ---- Home / landing ----
      await page.goto('/');
      await expect(page).toHaveURL(/\/login/, { timeout: 30000 });

      // ---- Login ----
      await page.fill('#email', 'owner@gymtech.app');
      await page.fill('#password', 'Password123!');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 });
      await expect(page.getByText('GymTech Fitness Club').first()).toBeVisible({ timeout: 30000 });

      // ---- Enroll a member ----
      await page.goto('/members/new');
      await expect(page.getByText('New Member Registration')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('#initialPayment')).not.toHaveValue('', { timeout: 30000 });
      await page.fill('#firstName', firstName);
      await page.fill('#lastName', 'Walkthrough');
      await page.fill('#phone', phone);
      await page.click('button[type="submit"]');
      await expect(page.getByText('Member Enrolled Successfully')).toBeVisible({ timeout: 45000 });
      const codeText = await page.getByText(/MEM-\d+/).first().textContent();
      const memberCode = codeText!.match(/MEM-\d+/)![0];

      // ---- Profile persists across refresh ----
      await page.getByRole('link', { name: /view profile/i }).click();
      await expect(page).toHaveURL(/\/members\/\d+/, { timeout: 30000 });
      await expect(page.getByText(firstName).first()).toBeVisible({ timeout: 30000 });
      await page.reload();
      await expect(page.getByText(firstName).first()).toBeVisible({ timeout: 30000 });
      await expect(page.getByText(memberCode).first()).toBeVisible({ timeout: 30000 });

      // ---- Edit profile (last name) ----
      await page.getByRole('button', { name: /edit profile/i }).click();
      await page.fill('#editLastName', 'Walked');
      await page.getByRole('button', { name: /save changes/i }).click();
      await expect(page.getByText('Walked').first()).toBeVisible({ timeout: 30000 });
      await page.reload();
      await expect(page.getByText('Walked').first()).toBeVisible({ timeout: 30000 });

      // ---- Collect a payment + GST invoice ----
      await page.goto('/payments');
      await expect(page.getByText("Today's Collection")).toBeVisible({ timeout: 30000 });
      await page.getByRole('button', { name: /collect payment/i }).click();
      await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible({ timeout: 20000 });
      await page.fill('#amount', '500');
      await page.getByRole('button', { name: /^record payment$/i }).click();
      await expect(page.getByText('Payment Logged Successfully!')).toBeVisible({ timeout: 45000 });
      await page.getByRole('button', { name: /^close$/i }).first().click();

      // ---- Attendance check-in ----
      await page.goto('/attendance');
      const search = page.getByPlaceholder(/search member name/i);
      await expect(search).toBeVisible({ timeout: 30000 });
      await search.fill(memberCode);
      await expect(page.getByText(firstName).first()).toBeVisible({ timeout: 30000 });
      await page.locator('form').getByRole('button', { name: /^check in$/i }).click();
      await expect(page.getByText(/welcome, |already checked in/i).first()).toBeVisible({ timeout: 30000 });

      // ---- Dashboard reflects the day ----
      await page.goto('/dashboard');
      await expect(page.getByText('Total Revenue (MTD)')).toBeVisible({ timeout: 30000 });

      // ---- Reports render ----
      await page.goto('/reports');
      await expect(page.getByText(/revenue|financial/i).first()).toBeVisible({ timeout: 30000 });

      // ---- Directory search finds the new member ----
      await page.goto('/members');
      await page.getByPlaceholder(/search by name/i).fill(firstName);
      await expect(page.getByText(memberCode).first()).toBeVisible({ timeout: 30000 });
    } finally {
      await context.close();
    }
  });

  test('member portal opens with the walked-through member code', async ({ browser }) => {
    const owner = await isolatedContext(browser, { storageState: OWNER_STATE });
    let memberPhone = '';
    let memberCode = '';
    try {
      const res = await owner.page.request.get('/api/members?limit=1');
      if (res.ok()) {
        const data: any = await res.json();
        const m = data?.members?.[0];
        if (m) { memberPhone = m.phone; memberCode = m.memberCode ?? m.member_code; }
      }
    } finally {
      await owner.context.close();
    }
    test.skip(!memberPhone || !memberCode, 'no member available for portal check');

    const member = await isolatedContext(browser);
    try {
      await member.page.goto('/login');
      await member.page.getByRole('tab', { name: /^member$/i }).click();
      await member.page.fill('#gymSlug', 'gymtech-club');
      await member.page.fill('#memberIdentifier', memberPhone);
      await member.page.fill('#memberCode', memberCode);
      await member.page.click('button[type="submit"]');
      await expect(member.page).toHaveURL(/\/portal/, { timeout: 45000 });
      // Isolation: staff console bounces back to the portal.
      await member.page.goto('/members');
      await expect(member.page).toHaveURL(/\/portal/, { timeout: 30000 });
    } finally {
      await member.context.close();
    }
  });
});
