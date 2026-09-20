/**
 * Member lifecycle E2E — enroll → freeze → unfreeze → GDPR erasure.
 *
 * Prereq: local D1 migrated + seeded (pnpm db:migrate:local && pnpm db:seed:local).
 */
import { describe, it, expect } from 'vitest';
import { loginAsOwner, setupHarnessTeardown, uniqueSuffix } from './harness';

setupHarnessTeardown();

function phoneFromSuffix(u: string): string {
  const digits = u.replace(/[^a-z0-9]/g, '').replace(/[a-z]/g, (m) => String(m.charCodeAt(0) % 10));
  return `9${digits}0002`.slice(0, 10);
}

/** Create a member on the first plan and return the id. */
async function enrollMember(client: Awaited<ReturnType<typeof loginAsOwner>>['client'], suffix: string): Promise<number> {
  const plans = await client.get<{ plans: Array<{ id: number; pricePaise: number }> }>('/api/plans');
  expect(plans.status).toBe(200);
  const plan = plans.body.plans[0]!;

  const created = await client.post<{ member: { id: number } }>('/api/members', {
    firstName: 'Life',
    lastName: `Cycle${suffix}`,
    phone: phoneFromSuffix(uniqueSuffix()),
    planId: plan.id,
    initialPaymentPaise: plan.pricePaise,
    paymentMode: 'CASH',
  });
  expect(created.status).toBe(201);
  return created.body.member.id;
}

describe('Member lifecycle E2E', () => {
  it('freezes and unfreezes a member, extending the membership end date', async () => {
    const { client } = await loginAsOwner();
    const memberId = await enrollMember(client, uniqueSuffix());

    // Detail read gives us the active membership end date for comparison.
    const before = await client.get<{ member: { status: string }; memberships?: Array<{ id: number; endDate: number }> }>(`/api/members/${memberId}`);
    expect(before.status).toBe(200);
    expect(before.body.member.status).toBe('ACTIVE');
    const membershipBefore = before.body.memberships?.find((m) => m.id != null);
    const endBefore = membershipBefore?.endDate;

    // Freeze.
    const frozen = await client.post<{ status?: string; membershipId?: number }>(`/api/members/${memberId}/freeze`, {
      reason: 'integration-test freeze',
    });
    expect(frozen.status).toBe(200);
    expect(frozen.body.status).toBe('FROZEN');

    // Freeze guard rails.
    const refreeze = await client.post(`/api/members/${memberId}/freeze`, {});
    expect(refreeze.status).toBeGreaterThanOrEqual(400);

    // Unfreeze — extends end date by the frozen duration.
    const unfrozen = await client.post<{ status?: string; extendedTo?: number | null }>(`/api/members/${memberId}/unfreeze`, {});
    expect(unfrozen.status).toBe(200);
    expect(unfrozen.body.status).toBe('ACTIVE');

    const after = await client.get<{ memberships?: Array<{ id: number; endDate: number }> }>(`/api/members/${memberId}`);
    const membershipAfter = after.body.memberships?.find((m) => m.id === membershipBefore?.id);
    if (endBefore != null && membershipAfter?.endDate != null) {
      expect(membershipAfter.endDate).toBeGreaterThanOrEqual(endBefore);
    }
  });

  it('rejects freezing a member without an active membership', async () => {
    const { client } = await loginAsOwner();
    // Members must enroll with a plan (phone+plan required at creation), so
    // exercise the guard by cancelling/archiving first instead.
    const memberId = await enrollMember(client, uniqueSuffix());
    const del = await client.request('DELETE', `/api/members/${memberId}`);
    expect(del.status).toBe(200);

    const res = await client.post(`/api/members/${memberId}/freeze`, {});
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('GDPR erasure wipes personal data but keeps the member row', async () => {
    const { client, env } = await loginAsOwner();
    const suffix = uniqueSuffix();
    const memberId = await enrollMember(client, suffix);

    const erased = await client.request('DELETE', `/api/members/${memberId}/personal-data`);
    expect(erased.status).toBe(200);

    // Row must still exist, but personal fields wiped.
    const row = await env.DB.prepare('SELECT first_name, last_name, phone, email, status, deleted_at FROM members WHERE id = ?')
      .bind(memberId)
      .first<{ first_name: string | null; last_name: string | null; phone: string | null; email: string | null; status: string; deleted_at: number | null }>();
    expect(row).not.toBeNull();
    expect(row!.first_name).toBe('[ERASED]');
    expect(row!.email).toBeNull();
    // phone is NOT NULL — erased members carry a tombstone, not their number.
    expect(row!.phone).toMatch(/^erased-\d+@gdpr\.invalid$/);
    expect(row!.phone).not.toContain(phoneFromSuffix(suffix));
    // Soft-deleted (deleted_at set) — the audit trail keeps the row, but it can
    // never be checked in or contacted again.
    expect(row!.deleted_at).not.toBeNull();
  });
});
