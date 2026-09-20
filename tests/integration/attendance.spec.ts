/**
 * Attendance E2E — desk check-in flow.
 *
 * Prereq: local D1 migrated + seeded (pnpm db:migrate:local && pnpm db:seed:local).
 */
import { describe, it, expect } from 'vitest';
import { loginAsOwner, setupHarnessTeardown, uniqueSuffix } from './harness';

setupHarnessTeardown();

function phoneFromSuffix(u: string): string {
  const digits = u.replace(/[^a-z0-9]/g, '').replace(/[a-z]/g, (m) => String(m.charCodeAt(0) % 10));
  return `9${digits}0004`.slice(0, 10);
}

describe('Attendance E2E', () => {
  it('checks a member in by numeric id and by identifier', async () => {
    const { client } = await loginAsOwner();
    const plans = await client.get<{ plans: Array<{ id: number; pricePaise: number }> }>('/api/plans');
    const plan = plans.body.plans[0]!;
    const suffix = uniqueSuffix();

    const created = await client.post<{ member: { id: number; phone: string } }>('/api/members', {
      firstName: 'Attend',
      lastName: `Flow${suffix}`,
      phone: phoneFromSuffix(suffix),
      planId: plan.id,
      initialPaymentPaise: plan.pricePaise,
      paymentMode: 'CASH',
    });
    expect(created.status).toBe(201);
    const memberId = created.body.member.id;

    // Check in by numeric id.
    const byId = await client.post<{ success?: boolean; member?: { id: number } } | { success: false; code: string }>(
      '/api/attendance/check-in',
      { memberIdOrCode: String(memberId) }
    );
    expect([200, 201]).toContain(byId.status);
    const byIdBody = byId.body as { success?: boolean; member?: { id: number } };
    if (byIdBody.success === false) {
      // Only acceptable failure is an expired-membership denial with explicit code.
      expect((byId.body as { code?: string }).code).toBe('MEMBERSHIP_EXPIRED');
    } else {
      expect(byIdBody.member?.id).toBe(memberId);
    }

    // Check in again by phone identifier — the second attempt may succeed
    // (alreadyCheckedIn=true) or be refused; either way no 5xx is the contract.
    const byPhone = await client.post('/api/attendance/check-in', { memberIdOrCode: created.body.member.phone });
    expect(byPhone.status).toBeLessThan(500);
  });

  it('refuses check-in for archived members', async () => {
    const { client } = await loginAsOwner();
    const plans = await client.get<{ plans: Array<{ id: number; pricePaise: number }> }>('/api/plans');
    const plan = plans.body.plans[0]!;
    const suffix = uniqueSuffix();

    const created = await client.post<{ member: { id: number } }>('/api/members', {
      firstName: 'Archived',
      lastName: `Checkin${suffix}`,
      phone: phoneFromSuffix(suffix),
      planId: plan.id,
      initialPaymentPaise: plan.pricePaise,
      paymentMode: 'CASH',
    });
    expect(created.status).toBe(201);
    const memberId = created.body.member.id;

    const archive = await client.post(`/api/members/${memberId}/archive`);
    expect(archive.status).toBe(200);

    const res = await client.post('/api/attendance/check-in', { memberIdOrCode: String(memberId) });
    // Archived members are invisible to the lookup → 404 (not a permission leak).
    expect([403, 404]).toContain(res.status);
  });

  it('blocks check-in for an expired member without override', async () => {
    const { client, env } = await loginAsOwner();
    // Expire an enrolled member's membership directly in D1 (no time travel needed).
    const plans = await client.get<{ plans: Array<{ id: number; pricePaise: number }> }>('/api/plans');
    const plan = plans.body.plans[0]!;
    const suffix = uniqueSuffix();
    const created = await client.post<{ member: { id: number } }>('/api/members', {
      firstName: 'Expired',
      lastName: `Checkin${suffix}`,
      phone: phoneFromSuffix(suffix),
      planId: plan.id,
      initialPaymentPaise: plan.pricePaise,
      paymentMode: 'CASH',
    });
    expect(created.status).toBe(201);
    const memberId = created.body.member.id;

    const expired = await env.DB.prepare(
      `UPDATE memberships SET endDate = strftime('%s','now') - 86400 WHERE memberId = ?`
    ).bind(memberId).run();
    expect(expired.meta.changes).toBeGreaterThan(0);

    const res = await client.post('/api/attendance/check-in', { memberIdOrCode: String(memberId) });
    // Expired → success=false with explicit MEMBERSHIP_EXPIRED code, 403.
    expect(res.status).toBe(403);
    expect((res.body as { code?: string }).code).toBe('MEMBERSHIP_EXPIRED');
  });

  it('lists today\'s attendance', async () => {
    const { client } = await loginAsOwner();
    const res = await client.get<{ logs: unknown[] }>('/api/attendance');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
  });

  it('concurrent double check-ins collapse to a single row', async () => {
    const { client } = await loginAsOwner();
    const plans = await client.get<{ plans: Array<{ id: number; pricePaise: number }> }>('/api/plans');
    const plan = plans.body.plans[0]!;
    const suffix = uniqueSuffix();

    const created = await client.post<{ member: { id: number; memberCode: string } }>('/api/members', {
      firstName: 'Racy',
      lastName: `Checkin${suffix}`,
      phone: phoneFromSuffix(suffix),
      planId: plan.id,
      initialPaymentPaise: plan.pricePaise,
      paymentMode: 'CASH',
    });
    expect(created.status).toBe(201);
    const memberId = created.body.member.id;
    const memberCode = created.body.member.memberCode;

    // Ten near-simultaneous taps (kiosk double-tap / retry storm). Without
    // the DB-level unique constraint + ON CONFLICT handling this inserts
    // duplicate rows for the same member/day.
    const attempts = await Promise.all(
      Array.from({ length: 10 }, () =>
        client.post('/api/attendance/check-in', { memberIdOrCode: String(memberId) })
      )
    );
    for (const a of attempts) expect(a.status).toBeLessThan(500);

    const list = await client.get<{ logs: Array<{ memberCode?: string }> }>('/api/attendance');
    expect(list.status).toBe(200);
    const mine = list.body.logs.filter((l) => l.memberCode === memberCode);
    expect(mine.length).toBe(1);
  });
});
