import { test, expect } from '@playwright/test';
import { createMember, csrfHeaders, currentUserId, isolatedContext, OWNER_STATE, ADMIN_STATE } from './helpers';

test.describe('Platform admin (live)', () => {
  test('provisions a new gym and its owner can sign in', async ({ browser }) => {
    const suffix = Date.now().toString().slice(-5);
    const slug = `e2egym${suffix}`;
    const ownerEmail = `e2e.owner.${suffix}@gym.test`.toLowerCase();
    const ownerPass = 'OwnerPass123!';

    const admin = await isolatedContext(browser, { storageState: ADMIN_STATE });
    try {
      await admin.page.goto('/admin');
      await expect(admin.page.getByText('GymTech Fitness Club').first()).toBeVisible({ timeout: 30000 });

      await admin.page.fill('#gName', `E2E Gym ${suffix}`);
      await admin.page.fill('#gSlug', slug);
      await admin.page.fill('#gCity', 'Bengaluru');
      await admin.page.fill('#gPhone', `7${suffix}01010`.slice(0, 10));
      await admin.page.fill('#oName', `E2E Owner ${suffix}`);
      await admin.page.fill('#oEmail', ownerEmail);
      await admin.page.fill('#oPhone', `8${suffix}02020`.slice(0, 10));
      await admin.page.fill('#oPass', ownerPass);
      await admin.page.getByRole('button', { name: /provision gym & owner/i }).click();
      await expect(admin.page.getByText('Tenant provisioned successfully!')).toBeVisible({ timeout: 45000 });
      await expect(admin.page.getByText(`E2E Gym ${suffix}`).first()).toBeVisible({ timeout: 30000 });

      // Gateways + audit tabs render (audit exercises the {events} envelope fix).
      await admin.page.getByRole('tab', { name: /gateway/i }).click();
      await expect(admin.page.getByText('Central Communication Gateways')).toBeVisible({ timeout: 30000 });
      await admin.page.getByRole('tab', { name: /audit/i }).click();
      await expect(admin.page.getByText(/gym\.create|platform/i).first()).toBeVisible({ timeout: 30000 });
    } finally {
      await admin.context.close();
    }

    // New tenant owner signs in and sees their own gym in isolation.
    const tenant = await isolatedContext(browser);
    try {
      await tenant.page.goto('/login');
      await tenant.page.fill('#email', ownerEmail);
      await tenant.page.fill('#password', ownerPass);
      await tenant.page.click('button[type="submit"]');
      await expect(tenant.page).toHaveURL(/\/dashboard/, { timeout: 45000 });
      await expect(tenant.page.getByText(`E2E Gym ${suffix}`).first()).toBeVisible({ timeout: 30000 });
      // Fresh gym has no members yet.
      await tenant.page.goto('/members');
      await expect(tenant.page.getByText('0', { exact: true }).first()).toBeVisible({ timeout: 30000 });
    } finally {
      await tenant.context.close();
    }
  });
});

test.describe('Member portal (live)', () => {
  test('member signs in and sees plan, payments and PT packages', async ({ browser }) => {
    // Enroll the portal subject and give it a PT package + logged session.
    const owner = await isolatedContext(browser, { storageState: OWNER_STATE });
    let portalMember: Awaited<ReturnType<typeof createMember>>;
    try {
      portalMember = await createMember(owner.context, {
        firstName: `Portal${Date.now().toString().slice(-5)}`,
      });
      const headers = await csrfHeaders(owner.context);
      const trainerId = await currentUserId(owner.context);
      const pkg = await owner.page.request.post('/api/pt/packages', {
        headers,
        data: {
          memberId: portalMember.id, trainerId, packageName: 'E2E Strength Pack',
          totalSessions: 10, amountPaise: 200000,
          startDate: '2026-09-01', expiryDate: '2026-12-31',
        },
      });
      if (!pkg.ok()) throw new Error(`package create failed: ${pkg.status()} ${await pkg.text()}`);
      const { id: packageId } = await pkg.json();
      const sess = await owner.page.request.post('/api/pt/sessions', {
        headers,
        data: { packageId, sessionDate: '2026-09-10', sessionNotes: 'E2E baseline' },
      });
      if (!sess.ok()) throw new Error(`session log failed: ${sess.status()} ${await sess.text()}`);
    } finally {
      await owner.context.close();
    }

    const member = await isolatedContext(browser);
    try {
      await member.page.goto('/login');
      await member.page.getByRole('tab', { name: /^member$/i }).click();
      await member.page.fill('#gymSlug', 'gymtech-club');
      await member.page.fill('#memberIdentifier', portalMember.phone);
      await member.page.fill('#memberCode', portalMember.memberCode);
      await member.page.click('button[type="submit"]');
      await expect(member.page).toHaveURL(/\/portal/, { timeout: 45000 });
      await expect(member.page.getByText(portalMember.firstName).first()).toBeVisible({ timeout: 30000 });
      await expect(member.page.getByText('Monthly General').first()).toBeVisible({ timeout: 30000 });
      await member.page.getByRole('tab', { name: /pt sessions/i }).click();
      await expect(member.page.getByText('E2E Strength Pack').first()).toBeVisible({ timeout: 30000 });
      await expect(member.page.getByText('E2E baseline').first()).toBeVisible({ timeout: 30000 });

      // Class timetable + self-service booking (member session, own spot only).
      await member.page.getByRole('tab', { name: /classes/i }).click();
      const bookSpot = member.page.getByRole('button', { name: /book spot/i }).first();
      if (await bookSpot.isVisible().catch(() => false)) {
        await bookSpot.click();
        await expect(member.page.getByText(/booked successfully/i).first()).toBeVisible({ timeout: 30000 });
      }
      // Member isolation: no staff console access.
      await member.page.goto('/members');
      await expect(member.page).toHaveURL(/\/portal/, { timeout: 30000 });
    } finally {
      await member.context.close();
    }
  });
});
