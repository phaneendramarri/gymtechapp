/**
 * Payments E2E — dues ledger, receipt numbering, member-payment recording.
 *
 * Prereq: local D1 migrated + seeded (pnpm db:migrate:local && pnpm db:seed:local).
 */
import { describe, it, expect } from 'vitest';
import { loginAsOwner, setupHarnessTeardown, uniqueSuffix } from './harness';

setupHarnessTeardown();

function phoneFromSuffix(u: string): string {
  const digits = u.replace(/[^a-z0-9]/g, '').replace(/[a-z]/g, (m) => String(m.charCodeAt(0) % 10));
  return `9${digits}0003`.slice(0, 10);
}

/** Enroll a member on the first plan; returns member + plan price. */
async function enroll(
  client: Awaited<ReturnType<typeof loginAsOwner>>['client'],
  suffix: string
): Promise<{ memberId: number; planId: number; pricePaise: number }> {
  const plans = await client.get<{ plans: Array<{ id: number; pricePaise: number }> }>('/api/plans');
  const plan = plans.body.plans[0]!;
  const created = await client.post<{ member: { id: number } }>('/api/members', {
    firstName: 'Pay',
    lastName: `Flow${suffix}`,
    phone: phoneFromSuffix(uniqueSuffix()),
    planId: plan.id,
    initialPaymentPaise: plan.pricePaise,
    paymentMode: 'CASH',
  });
  expect(created.status).toBe(201);
  return { memberId: created.body.member.id, planId: plan.id, pricePaise: plan.pricePaise };
}

describe('Payments E2E', () => {
  it('records a payment and mints a year-scoped receipt number', async () => {
    const { client } = await loginAsOwner();
    const { memberId, planId, pricePaise } = await enroll(client, uniqueSuffix());

    const res = await client.post<{ receiptNumber?: string; payment?: { receiptNumber: string }; id?: number }>('/api/payments', {
      memberId,
      planId,
      amountPaise: pricePaise,
      paymentMode: 'UPI',
    });
    // Contract: must succeed and produce an RCP-YYYY-NNNN receipt.
    expect(res.status).toBe(201);
    const receipt =
      res.body.receiptNumber ?? res.body.payment?.receiptNumber ?? null;
    expect(receipt).toMatch(/^RCP-\d{4}-\d{4,}$/);
  });

  it('rejects a payment for a member from another gym (tenant isolation)', async () => {
    const { client, env } = await loginAsOwner();
    const other = await env.DB.prepare(
      `SELECT id FROM members WHERE gym_id <> (SELECT gym_id FROM users WHERE email = ?) ORDER BY id DESC LIMIT 1`
    )
      .bind('owner@gymtech.app')
      .first<{ id: number }>();
    if (!other) return; // single-gym dataset

    const res = await client.post('/api/payments', {
      memberId: other.id,
      planId: 1,
      amountPaise: 100000,
      paymentMode: 'CASH',
    });
    expect([400, 403, 404]).toContain(res.status);
  });

  it('rejects payments with non-positive amounts', async () => {
    const { client } = await loginAsOwner();
    const { memberId, planId } = await enroll(client, uniqueSuffix());
    const res = await client.post('/api/payments', {
      memberId,
      planId,
      amountPaise: 0,
      paymentMode: 'CASH',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
