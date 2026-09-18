/**
 * End-to-end flow suite — the real app, real D1, real routes, no mocks.
 *
 * Covers the flows touched by the architecture pass:
 *   role/permission authorization (users.role removal),
 *   member → membership → payment (year-scoped receipt counter),
 *   staff custom roles (CHECK-constraint regression),
 *   tenant isolation probes (cross-gym access must fail).
 *
 * Prereq: local D1 migrated + seeded (pnpm db:migrate:local && pnpm db:seed:local).
 */
import { describe, it, expect } from 'vitest';
import { loginAsOwner, setupHarnessTeardown, uniqueSuffix } from './harness';

setupHarnessTeardown();

/** Make a unique 10-digit phone from a run-unique suffix. */
function phoneFromSuffix(u: string): string {
  const digits = u.replace(/[^a-z0-9]/g, '').replace(/[a-z]/g, (m) => String(m.charCodeAt(0) % 10));
  return `9${digits}0001`.slice(0, 10);
}

describe('E2E — member → membership → payment flow', () => {
  it('creates a member with a plan, renews, and mints year-scoped receipts', async () => {
    const { client } = await loginAsOwner();

    // 1. List plans (seeded), pick the first.
    const plans = await client.get<{ plans: Array<{ id: number; pricePaise: number }> }>('/api/plans');
    expect(plans.status).toBe(200);
    expect(plans.body.plans.length).toBeGreaterThan(0);
    const plan = plans.body.plans[0];

    // 2. Create member with that plan — exercises the composite-FK path that
    //    used to throw `foreign key mismatch` on insert.
    const created = await client.post<{ member: { id: number; memberCode: string } }>('/api/members', {
      firstName: 'E2E',
      lastName: `Arch${uniqueSuffix()}`,
      phone: phoneFromSuffix(uniqueSuffix()),
      planId: plan.id,
      initialPaymentPaise: plan.pricePaise,
      paymentMode: 'CASH',
    });
    expect(created.status).toBe(201);
    const memberId = created.body.member.id;
    expect(memberId).toBeGreaterThan(0);

    // 3. Member details resolve (service read path).
    const detail = await client.get(`/api/members/${memberId}`);
    expect(detail.status).toBe(200);

    // 4. Renew — the second receipt-number path (counter increment).
    const renew = await client.post<{ receiptNumber: string }>(`/api/members/${memberId}/renew`, {
      planId: plan.id,
      paymentPaise: plan.pricePaise,
      paymentMode: 'CASH',
    });
    expect(renew.status).toBe(200);
    expect(renew.body.receiptNumber).toMatch(/^RCP-\d{4}-\d{4,}$/);

    // 5. Payments list resolves for the gym.
    const payments = await client.get('/api/payments');
    expect(payments.status).toBe(200);
  });
});

describe('E2E — roles & staff (users.role removed)', () => {
  it('lists staff with role-derived permissions', async () => {
    const { client } = await loginAsOwner();
    const res = await client.get<{ staff: Array<{ id: number; role?: string | null; permissions?: string[] }> }>(
      '/api/staff'
    );
    expect(res.status).toBe(200);
    const staff = res.body.staff;
    expect(Array.isArray(staff)).toBe(true);
    // Every row must present a coarse role derived from role_id — never a
    // stored column, and never an unknown role name.
    for (const s of staff) {
      expect(typeof s.id).toBe('number');
      if (s.role) {
        expect(['OWNER', 'MANAGER', 'STAFF', 'TRAINER', 'MEMBER', 'PLATFORM_ADMIN']).toContain(s.role);
      }
    }
  });

  it('creates a custom role and assigns it to a new staff member', async () => {
    const { client } = await loginAsOwner();
    const u = uniqueSuffix();

    // 1. Create a custom role with a subset of permissions.
    const role = await client.post<{ id?: number }>('/api/roles', {
      name: `Desk${u}`,
      description: 'Front-desk custom role',
      permissions: ['members', 'attendance'],
    });
    expect([200, 201]).toContain(role.status);

    // 2. Create a staff member assigned to it — this used to violate the
    //    users.role CHECK constraint; the column no longer exists.
    const staff = await client.post('/api/staff', {
      name: `Desk Staff ${u}`,
      email: `desk.${u.toLowerCase()}@e2e.test`,
      password: 'StaffPass123!',
      phone: phoneFromSuffix(uniqueSuffix()),
      roleId: role.body?.id,
      permissions: ['members', 'attendance'],
    });
    expect([200, 201]).toContain(staff.status);
  });
});

describe('E2E — tenant isolation probes', () => {
  it('rejects cross-gym member access with 404 (not a leak)', async () => {
    const { client, env } = await loginAsOwner();

    // Find a member id from ANOTHER gym directly in D1, then try to read it
    // through the API as the owner of gym 1.
    const other = await env.DB.prepare(
      `SELECT m.id FROM members m WHERE m.gym_id <> (SELECT gym_id FROM users WHERE email = ?)
       ORDER BY m.id DESC LIMIT 1`
    )
      .bind('owner@gymtech.app')
      .first<{ id: number }>();

    if (!other) return; // single-gym dataset — nothing to probe

    const res = await client.get(`/api/members/${other.id}`);
    expect([403, 404]).toContain(res.status);
  });

  it('rejects cross-gym plan update', async () => {
    const { client, env } = await loginAsOwner();
    const other = await env.DB.prepare(
      `SELECT id FROM membership_plans
       WHERE gym_id <> (SELECT gym_id FROM users WHERE email = ?)
       ORDER BY id DESC LIMIT 1`
    )
      .bind('owner@gymtech.app')
      .first<{ id: number }>();

    if (!other) return;

    const res = await client.request('PUT', `/api/plans/${other.id}`, {
      body: { name: 'Hijacked', pricePaise: 1, durationMonths: 1 },
    });
    expect([403, 404]).toContain(res.status);
  });
});
