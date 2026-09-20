import { test, expect } from '@playwright/test';
import { createMember, isolatedContext, OWNER_STATE } from './helpers';

test.describe('Plans (live)', () => {
  test('creates a plan and it persists across refresh', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      const name = `E2E Plan ${Date.now().toString().slice(-6)}`;
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

test.describe('Payments (live)', () => {
  test('collects a payment and opens the GST invoice', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      await page.goto('/payments');
      await expect(page.getByText("Today's Collection")).toBeVisible({ timeout: 30000 });
      await page.getByRole('button', { name: /collect payment/i }).click();
      await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible({ timeout: 20000 });
      await page.fill('#amount', '500');
      await page.getByRole('button', { name: /^record payment$/i }).click();
      // Success dialog mints the receipt and offers WhatsApp share.
      await expect(page.getByText('Payment Logged Successfully!')).toBeVisible({ timeout: 45000 });
      await expect(page.getByText(/RCP-/).first()).toBeVisible();
      await expect(page.getByRole('link', { name: /whatsapp/i })).toBeVisible();
      await page.getByRole('button', { name: /^close$/i }).first().click();
      // Ledger shows the new RCP- receipt row; receipt button opens the invoice.
      await expect(page.getByText(/RCP-/).first()).toBeVisible({ timeout: 30000 });
      await page.locator('table').getByText(/RCP-/).first().click();
      await expect(page.getByText('Tax Invoice / Receipt')).toBeVisible({ timeout: 20000 });
    } finally {
      await context.close();
    }
  });

  test('zero-amount payment is rejected', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      await page.goto('/payments');
      await expect(page.getByText("Today's Collection")).toBeVisible({ timeout: 30000 });
      await page.getByRole('button', { name: /collect payment/i }).click();
      await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible({ timeout: 20000 });
      await page.fill('#amount', '0');
      await page.getByRole('button', { name: /^record payment$/i }).click();
      // Dialog stays open — nothing recorded.
      await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible({ timeout: 10000 });
    } finally {
      await context.close();
    }
  });
});

test.describe('Attendance (live)', () => {
  test('checks in a member, flags duplicates, rejects unknown codes', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      // Enroll the member this test checks in, so it owns its fixture.
      const member = await createMember(context, { firstName: `Attend${Date.now().toString().slice(-5)}` });
      await page.goto('/attendance');
      const search = page.getByPlaceholder(/search member name/i);
      await expect(search).toBeVisible({ timeout: 30000 });

      // Unknown code → empty state.
      await search.fill('NOPE-0000');
      await expect(page.getByText(/no member found/i)).toBeVisible({ timeout: 30000 });
      await search.fill('');

      // Known member → welcome panel.
      await search.fill(member.memberCode);
      await expect(page.getByText(member.firstName).first()).toBeVisible({ timeout: 30000 });
      await page.locator('form').getByRole('button', { name: /^check in$/i }).click();
      await expect(page.getByText(new RegExp(`welcome, ${member.firstName}`, 'i')).first()).toBeVisible({ timeout: 30000 });

      // Second check-in of the same member → duplicate notice.
      await search.fill(member.memberCode);
      await page.locator('form').getByRole('button', { name: /^check in$/i }).click();
      await expect(page.getByText(/already checked in|duplicate/i).first()).toBeVisible({ timeout: 30000 });
    } finally {
      await context.close();
    }
  });
});
