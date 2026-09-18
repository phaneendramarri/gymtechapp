/**
 * PT collections E2E — record → summary → settle.
 *
 * Prereq: local D1 migrated + seeded (pnpm db:migrate:local && pnpm db:seed:local).
 */
import { describe, it, expect } from 'vitest';
import { loginAsOwner, setupHarnessTeardown, uniqueSuffix } from './harness';

setupHarnessTeardown();

function phoneFromSuffix(u: string): string {
  const digits = u.replace(/[^a-z0-9]/g, '').replace(/[a-z]/g, (m) => String(m.charCodeAt(0) % 10));
  return `9${digits}0006`.slice(0, 10);
}

describe('PT collections E2E', () => {
  it('records a PT collection with receipt and settles its commission', async () => {
    const { client, env } = await loginAsOwner();

    // Seed: owner gym, first member, and a trainer user in the same gym.
    const member = await env.DB.prepare(
      `SELECT id FROM members WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 1`
    ).first<{ id: number }>();
    const trainer = await env.DB.prepare(
      `SELECT u.id FROM users u
       JOIN roles r ON r.id = u.role_id AND r.name = 'TRAINER'
       WHERE u.gym_id = (SELECT gym_id FROM users WHERE email = ?) AND u.deleted_at IS NULL
       ORDER BY u.id ASC LIMIT 1`
    )
      .bind('owner@gymtech.app')
      .first<{ id: number }>();
    if (!member || !trainer) return; // dataset lacks the fixtures — skip

    const suffix = uniqueSuffix();
    const record = await client.post<{ id: number; receiptNumber?: string }>('/api/pt/collections', {
      memberId: member.id,
      trainerId: trainer.id,
      sessions: 8,
      amountPaise: 800000,
      commissionPercentage: 30,
      paymentMode: 'UPI',
    });
    expect([200, 201]).toContain(record.status);
    const collectionId = record.body.id;
    expect(collectionId).toBeGreaterThan(0);

    // Summary must reflect the recorded amount and pending commission.
    const summary = await client.get<{
      totalCollected: number;
      totalCommissionPending: number;
      totalCommissionPaid: number;
    }>('/api/pt/summary');
    expect(summary.status).toBe(200);
    expect(summary.body.totalCollected).toBeGreaterThan(0);
    expect(summary.body.totalCommissionPending).toBeGreaterThan(0);

    // Settle it.
    const settle = await client.post(`/api/pt/collections/${collectionId}/settle`, { status: 'PAID' });
    expect(settle.status).toBe(200);

    const after = await client.get<{ totalCommissionPaid: number }>('/api/pt/summary');
    expect(after.status).toBe(200);
    expect(after.body.totalCommissionPaid).toBeGreaterThan(0);
  });

  it('rejects a PT collection for an out-of-gym trainer', async () => {
    const { client, env } = await loginAsOwner();
    const member = await env.DB.prepare(
      `SELECT id FROM members WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 1`
    ).first<{ id: number }>();
    const otherTrainer = await env.DB.prepare(
      `SELECT u.id FROM users u
       JOIN roles r ON r.id = u.role_id AND r.name = 'TRAINER'
       WHERE u.gym_id <> (SELECT gym_id FROM users WHERE email = ?) AND u.deleted_at IS NULL
       ORDER BY u.id ASC LIMIT 1`
    )
      .bind('owner@gymtech.app')
      .first<{ id: number }>();
    if (!member || !otherTrainer) return;

    const res = await client.post('/api/pt/collections', {
      memberId: member.id,
      trainerId: otherTrainer.id,
      sessions: 1,
      amountPaise: 100000,
      commissionPercentage: 0,
    });
    expect([400, 403, 404]).toContain(res.status);
  });
});
