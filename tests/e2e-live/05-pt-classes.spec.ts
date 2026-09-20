import { test, expect } from '@playwright/test';
import { createMember, isolatedContext, OWNER_STATE } from './helpers';

test.describe('PT collections (live)', () => {
  test('records a collection and settles the commission', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      // Own the fixture: enroll the member the collection is recorded against.
      const member = await createMember(context, { firstName: `Pt${Date.now().toString().slice(-5)}` });

      await page.goto('/pt-collections');
      await expect(page.getByText('Commission Pending').first()).toBeVisible({ timeout: 30000 });

      await page.getByRole('button', { name: /record pt collection/i }).click();
      await expect(page.getByRole('heading', { name: 'Record PT Collection' })).toBeVisible();

      // Member select (radix) — pick the member enrolled above, by its code.
      await page.locator('#pt-member').click();
      await page.getByRole('option', { name: new RegExp(member.memberCode) }).click();
      // Trainer select — the gym owner is always eligible.
      await page.locator('#pt-trainer').click();
      await page.getByRole('option', { name: /gym owner/i }).click();

      await page.fill('#pt-amount', '12000');
      await page.getByRole('button', { name: /^record collection$/i }).click();
      await expect(page.getByText('PT collection recorded')).toBeVisible({ timeout: 30000 });

      // The fresh row is PENDING (older settled rows for the same member
      // are PAID) — filter by status, not position, to avoid a refetch race.
      const row = page.locator('tr', { hasText: member.memberCode }).filter({ hasText: 'PENDING' }).first();
      await expect(row).toBeVisible({ timeout: 30000 });

      // Settle → PAID (re-query after the status flip — the PENDING
      // locator goes stale once React re-renders the row as PAID).
      await row.getByRole('button', { name: /mark paid/i }).click();
      await expect(page.getByText('Commission marked as paid')).toBeVisible({ timeout: 30000 });
      const paidRow = page.locator('tr', { hasText: member.memberCode }).filter({ hasText: 'PAID' }).first();
      await expect(paidRow.getByText('PAID')).toBeVisible({ timeout: 30000 });
    } finally {
      await context.close();
    }
  });
});

test.describe('Classes (live)', () => {
  test('creates a class, adds a slot, books and cancels a member', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      const suffix = Date.now().toString().slice(-5);
      const className = `E2E Yoga ${suffix}`;
      const member = await createMember(context, { firstName: `Class${suffix}` });

      await page.goto('/classes');
      await expect(page.getByText('Class Schedules & Timetable')).toBeVisible({ timeout: 30000 });

      // ---- Create class type ----
      await page.getByRole('button', { name: /add class type/i }).click();
      await page.getByPlaceholder(/power yoga/i).fill(className);
      await page.getByRole('button', { name: /^create class$/i }).click();
      await expect(page.getByText(className).first()).toBeVisible({ timeout: 30000 });

      // ---- Add timetable slot (native selects) ----
      await page.getByRole('button', { name: /add timetable slot/i }).click();
      const classSelect = page.locator('select').first();
      const classValue = await classSelect.evaluate((el: HTMLSelectElement, name: string) => {
        const opt = Array.from(el.options).find((o) => o.text.includes(name));
        return opt ? opt.value : '';
      }, className);
      if (!classValue) throw new Error(`new class missing from slot dropdown: ${className}`);
      await classSelect.selectOption(classValue);
      await page.getByRole('button', { name: /^add slot$/i }).click();
      await expect(page.getByText(className).first()).toBeVisible({ timeout: 30000 });

      // ---- Open the slot roster and book the enrolled member ----
      await page.getByRole('button', { name: /bookings & roster/i }).first().click();
      await expect(page.getByText(/roster/i).first()).toBeVisible({ timeout: 30000 });
      await page.getByPlaceholder(/member code/i).fill(member.memberCode);
      await page.getByRole('button', { name: /book spot/i }).click();
      await expect(page.getByText(member.memberCode).first()).toBeVisible({ timeout: 30000 });

      // ---- Cancel the booking ----
      await page.getByTitle('Cancel Booking').first().click();
      await expect(page.getByText('Booking cancelled')).toBeVisible({ timeout: 30000 });
    } finally {
      await context.close();
    }
  });
});
