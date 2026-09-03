import { describe, it, expect, vi } from 'vitest';
import { MemberRepository } from '../../apps/api/src/repositories/member.repository';
import { PaymentRepository } from '../../apps/api/src/repositories/payment.repository';
import { MembershipRepository } from '../../apps/api/src/repositories/membership.repository';

describe('Tenant Isolation Security Invariants', () => {
  function createMockDb() {
    let capturedQuery = '';
    let capturedBindings: any[] = [];

    const mockDb: any = {
      prepare: vi.fn((query: string) => {
        capturedQuery = query;
        return {
          bind: vi.fn((...bindings: any[]) => {
            capturedBindings = bindings;
            return {
              all: vi.fn().mockResolvedValue({ results: [] }),
              first: vi.fn().mockResolvedValue(null),
              run: vi.fn().mockResolvedValue({ success: true }),
              raw: vi.fn().mockResolvedValue([]),
            };
          }),
        };
      }),
      getLastQuery: () => capturedQuery,
      getLastBindings: () => capturedBindings,
    };

    return mockDb;
  }

  it('enforces gym_id boundary on member queries', async () => {
    const mockDb = createMockDb();
    const gymIdA = 101;
    const memberRepoA = new MemberRepository(mockDb, gymIdA);

    // List members
    await memberRepoA.list({});
    expect(mockDb.getLastQuery()).toMatch(/gym_id["\s]*=\s*(\?|101)/i);

    // Find member by ID
    await memberRepoA.findById(123);
    expect(mockDb.getLastQuery()).toMatch(/gym_id/i);
    expect(mockDb.getLastBindings()).toContain(gymIdA);
  });

  it('enforces gym_id boundary on payment queries', async () => {
    const mockDb = createMockDb();
    const gymIdB = 202;
    const paymentRepoB = new PaymentRepository(mockDb, gymIdB);

    await paymentRepoB.list({});
    expect(mockDb.getLastQuery()).toMatch(/gym_id["\s]*=\s*\?/i);
    expect(mockDb.getLastBindings()).toContain(gymIdB);

    await paymentRepoB.getSummaryMetrics();
    expect(mockDb.getLastQuery()).toMatch(/gym_id["\s]*=\s*\?/i);
    expect(mockDb.getLastBindings()).toContain(gymIdB);
  });

  it('enforces gym_id boundary on membership renewals and searches', async () => {
    const mockDb = createMockDb();
    const gymIdA = 101;
    const membershipRepo = new MembershipRepository(mockDb, gymIdA);

    await membershipRepo.findByMemberId(456);
    expect(mockDb.getLastQuery()).toMatch(/gym_id["\s]*=\s*\?/i);
    expect(mockDb.getLastBindings()).toContain(gymIdA);
  });
});

