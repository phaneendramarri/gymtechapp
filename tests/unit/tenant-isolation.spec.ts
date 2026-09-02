import { describe, it, expect, vi } from 'vitest';
import { MemberRepository } from '../../apps/api/src/repositories/member.repository';
import { PaymentRepository } from '../../apps/api/src/repositories/payment.repository';
import { MembershipRepository } from '../../apps/api/src/repositories/membership.repository';

describe('Tenant Isolation Security Invariants', () => {
  it('enforces gym_id boundary on member queries', async () => {
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
            };
          }),
        };
      }),
    };

    const gymIdA = 'gym_tenant_alpha';
    const memberRepoA = new MemberRepository(mockDb, gymIdA);

    // List members
    await memberRepoA.list({});
    expect(capturedQuery).toContain('WHERE m.gym_id = ?');
    expect(capturedBindings[0]).toBe(gymIdA);

    // Find member by ID
    await memberRepoA.findById('mem_target_123');
    expect(capturedQuery).toContain('WHERE id = ? AND gym_id = ?');
    expect(capturedBindings).toEqual(['mem_target_123', gymIdA]);
  });

  it('enforces gym_id boundary on payment queries', async () => {
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
            };
          }),
        };
      }),
    };

    const gymIdB = 'gym_tenant_beta';
    const paymentRepoB = new PaymentRepository(mockDb, gymIdB);

    await paymentRepoB.list({});
    expect(capturedQuery).toContain('WHERE p.gym_id = ?');
    expect(capturedBindings[0]).toBe(gymIdB);

    await paymentRepoB.getSummaryMetrics();
    expect(capturedQuery).toContain('WHERE gym_id = ?');
    expect(capturedBindings[0]).toBe(gymIdB);
  });

  it('enforces gym_id boundary on membership renewals and searches', async () => {
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
            };
          }),
        };
      }),
    };

    const gymIdA = 'gym_tenant_alpha';
    const membershipRepo = new MembershipRepository(mockDb, gymIdA);

    await membershipRepo.findByMemberId('mem_xyz');
    expect(capturedQuery).toContain('WHERE ms.member_id = ? AND ms.gym_id = ?');
    expect(capturedBindings).toEqual(['mem_xyz', gymIdA]);
  });
});
