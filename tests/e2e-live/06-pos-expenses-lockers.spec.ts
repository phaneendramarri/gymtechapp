import { test, expect } from '@playwright/test';
import { createMember, isolatedContext, OWNER_STATE } from './helpers';

test.describe('POS (live)', () => {
  test('adds a product, sells it, decrements stock', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      const suffix = Date.now().toString().slice(-5);
      const product = `E2E Whey ${suffix}`;

      await page.goto('/pos');
      await expect(page.getByText('POS Register')).toBeVisible({ timeout: 30000 });

      // ---- Add product via Inventory tab ----
      await page.getByRole('button', { name: /inventory & stock/i }).click();
      await page.getByRole('button', { name: /^add product$/i }).click();
      await page.getByPlaceholder(/whey protein/i).fill(product);
      await page.getByPlaceholder('e.g. 150').fill('150');
      // Initial stock field follows the cost field; set 10 via spinbuttons.
      const stockSpin = page.locator('input[type="number"]').nth(2);
      await stockSpin.fill('10');
      await page.getByRole('button', { name: /^save product$/i }).click();
      await expect(page.getByText(product).first()).toBeVisible({ timeout: 30000 });

      // ---- Sell one unit at the register ----
      // Own the fixture: the sale is attributed to a member enrolled here.
      const member = await createMember(context, { firstName: `Pos${suffix}` });

      await page.getByRole('button', { name: /pos register/i }).click();
      await page.getByRole('button', { name: new RegExp(product) }).click();
      await page.getByPlaceholder(/member code/i).fill(member.memberCode);
      await page.getByRole('button', { name: /charge /i }).click();
      await expect(page.getByText('Sale Successful!')).toBeVisible({ timeout: 30000 });
      await expect(page.getByText(/receipt #/i)).toBeVisible();
      await page.getByRole('button', { name: /done \/ next sale/i }).click();

      // ---- Stock decremented 10 → 9 ----
      await page.getByRole('button', { name: /inventory & stock/i }).click();
      const row = page.locator('tr', { hasText: product }).first();
      await expect(row).toBeVisible({ timeout: 30000 });
      await expect(row).toContainText('9');
    } finally {
      await context.close();
    }
  });
});

test.describe('Expenses (live)', () => {
  test('creates a category, logs an expense, sees it in P&L', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      const suffix = Date.now().toString().slice(-5);
      const category = `E2E Cat ${suffix}`;
      const title = `E2E Power Bill ${suffix}`;

      await page.goto('/expenses');
      await expect(page.getByText('Gym Expenses & P&L')).toBeVisible({ timeout: 30000 });

      await page.getByRole('button', { name: /\+ category/i }).click();
      await page.getByPlaceholder(/marketing, equipment, rent/i).fill(category);
      await page.getByRole('button', { name: 'Save' }).click();
      // Categories surface in the filter dropdown (no category cards exist).
      const filterSelect = page.locator('select').first();
      await expect(filterSelect).toContainText(category, { timeout: 30000 });

      await page.getByRole('button', { name: /log expense/i }).click();
      await page.getByPlaceholder(/electricity bill/i).fill(title);
      // Scope to the modal's form — the page-level filter bar also has a select.
      const catSelect = page.locator('form select').first();
      const catValue = await catSelect.evaluate((el: HTMLSelectElement, name: string) => {
        const opt = Array.from(el.options).find((o) => o.text.includes(name));
        return opt ? opt.value : '';
      }, category);
      if (!catValue) throw new Error('new category missing from expense dropdown');
      await catSelect.selectOption(catValue);
      await page.getByPlaceholder('e.g. 2500').fill('2500');
      await page.getByRole('button', { name: /^record expense$/i }).click();
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 30000 });
      await expect(page.getByText('Net Operating Profit', { exact: true })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe('Lockers (live)', () => {
  test('adds a locker, allocates it, releases it', async ({ browser }) => {
    const { context, page } = await isolatedContext(browser, { storageState: OWNER_STATE });
    try {
      const suffix = Date.now().toString().slice(-5);
      const lockerNo = `L-E2E${suffix}`.slice(0, 12);
      const member = await createMember(context, { firstName: `Lock${suffix}` });

      await page.goto('/lockers');
      await expect(page.getByText(/locker/i).first()).toBeVisible({ timeout: 30000 });

      await page.getByRole('button', { name: /add locker unit/i }).click();
      await page.getByPlaceholder(/l-101/i).fill(lockerNo);
      await page.getByRole('button', { name: /^add locker$/i }).click();
      await expect(page.getByText(lockerNo).first()).toBeVisible({ timeout: 30000 });

      // Allocate to the enrolled member.
      const card = page.locator('div', { hasText: lockerNo }).last();
      await card.getByRole('button', { name: /allocate/i }).click({ timeout: 15000 }).catch(async () => {
        await page.getByRole('button', { name: /allocate/i }).first().click();
      });
      await page.getByPlaceholder(/member code/i).fill(member.memberCode);
      await page.getByRole('button', { name: /confirm allocation/i }).click();
      await expect(page.getByText(/allocated|assigned|success/i).first()).toBeVisible({ timeout: 30000 });

      // Release it back.
      await page.getByRole('button', { name: /release/i }).first().click();
      await expect(page.getByText(/released|available|success/i).first()).toBeVisible({ timeout: 30000 });
    } finally {
      await context.close();
    }
  });
});
