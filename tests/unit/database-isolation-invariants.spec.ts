import { describe, it, expect, vi } from 'vitest';
import { AttendanceRepository } from '../../apps/api/src/repositories/attendance.repository';
import { PlanRepository } from '../../apps/api/src/repositories/plan.repository';
import { PaymentRepository } from '../../apps/api/src/repositories/payment.repository';
import { MembershipRepository } from '../../apps/api/src/repositories/membership.repository';
import { MemberRepository } from '../../apps/api/src/repositories/member.repository';
import { LicenseRepository } from '../../apps/api/src/repositories/license.repository';

describe('Multi-Tenant Database Isolation Invariants', () => {
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
              run: vi.fn().mockResolvedValue({ success: true, meta: { last_row_id: 1 } }),
            };
          }),
        };
      }),
      getLastQuery: () => capturedQuery,
      getLastBindings: () => capturedBindings,
    };

    return mockDb;
  }

  const GYM_ALPHA = 101;
  const GYM_BETA = 202;

  describe('AttendanceRepository Isolation', () => {
    it('scopes listToday to the specific gym_id', async () => {
      const mockDb = createMockDb();
      const repo = new AttendanceRepository(mockDb, GYM_ALPHA);
      await repo.listToday();

      expect(mockDb.getLastQuery()).toContain('WHERE a.gym_id = ?');
      expect(mockDb.getLastBindings()[0]).toBe(GYM_ALPHA);
    });

    it('scopes check-in duplicate check and insertion to the specific gym_id', async () => {
      const mockDb = createMockDb();
      const repo = new AttendanceRepository(mockDb, GYM_ALPHA);
      await repo.checkIn({ member_id: 55, method: 'QR' });

      expect(mockDb.getLastBindings()).toContain(GYM_ALPHA);
    });
  });

  describe('PlanRepository Isolation', () => {
    it('scopes listActive to gym_id and ignores other gym plans', async () => {
      const mockDb = createMockDb();
      const repo = new PlanRepository(mockDb, GYM_ALPHA);
      await repo.listActive();

      expect(mockDb.getLastQuery()).toContain('WHERE gym_id = ?');
      expect(mockDb.getLastBindings()).toContain(GYM_ALPHA);
    });

    it('scopes findById to gym_id preventing cross-tenant plan retrieval', async () => {
      const mockDb = createMockDb();
      const repo = new PlanRepository(mockDb, GYM_ALPHA);
      await repo.findById(99);

      expect(mockDb.getLastQuery()).toContain('WHERE id = ? AND gym_id = ?');
      expect(mockDb.getLastBindings()).toEqual([99, GYM_ALPHA]);
    });

    it('scopes update mutation to gym_id', async () => {
      const mockDb = createMockDb();
      const repo = new PlanRepository(mockDb, GYM_ALPHA);

      await repo.update(42, { name: 'New Plan Name', is_active: 0 });
      expect(mockDb.getLastQuery()).toContain('WHERE id = ? AND gym_id = ?');
      expect(mockDb.getLastBindings()).toContain(GYM_ALPHA);
    });
  });

  describe('MemberRepository Isolation & Safe Mutations', () => {
    it('scopes list to target gym_id', async () => {
      const mockDb = createMockDb();
      const repo = new MemberRepository(mockDb, GYM_ALPHA);
      await repo.list({});

      expect(mockDb.getLastQuery()).toContain('WHERE m.gym_id = ?');
      expect(mockDb.getLastBindings()[0]).toBe(GYM_ALPHA);
    });

    it('scopes update mutation to target gym_id', async () => {
      const mockDb = createMockDb();
      const repo = new MemberRepository(mockDb, GYM_ALPHA);
      await repo.update(123, { phone: '9999999999', status: 'BLOCKED' });

      expect(mockDb.getLastQuery()).toContain('WHERE id = ? AND gym_id = ?');
      expect(mockDb.getLastBindings()).toContain(GYM_ALPHA);
    });

    it('scopes findByIdentifier lookup to gym_id so phone/code collisions across gyms do not leak data', async () => {
      const mockDb = createMockDb();
      const repo = new MemberRepository(mockDb, GYM_ALPHA);
      await repo.findByIdentifier('9876543210');

      expect(mockDb.getLastQuery()).toContain('WHERE gym_id = ?');
      expect(mockDb.getLastBindings()[0]).toBe(GYM_ALPHA);
    });

    it('scopes getTodayAttendance to gym_id', async () => {
      const mockDb = createMockDb();
      const repo = new MemberRepository(mockDb, GYM_ALPHA);
      await repo.getTodayAttendance();

      expect(mockDb.getLastQuery()).toContain('WHERE a.gym_id = ?');
      expect(mockDb.getLastBindings()[0]).toBe(GYM_ALPHA);
    });
  });

  describe('PaymentRepository Isolation', () => {
    it('scopes next receipt number sequence strictly to current gym_id', async () => {
      const mockDb = createMockDb();
      const repo = new PaymentRepository(mockDb, GYM_ALPHA);
      await repo.getNextReceiptNumber();

      expect(mockDb.getLastQuery()).toContain('SELECT COUNT(*) as total FROM payments WHERE gym_id = ?');
      expect(mockDb.getLastBindings()).toEqual([GYM_ALPHA]);
    });

    it('scopes summary metrics to gym_id', async () => {
      const mockDb = createMockDb();
      const repo = new PaymentRepository(mockDb, GYM_BETA);
      await repo.getSummaryMetrics();

      expect(mockDb.getLastQuery()).toContain('WHERE gym_id = ?');
      expect(mockDb.getLastBindings()).toContain(GYM_BETA);
    });
  });

  describe('LicenseRepository Isolation', () => {
    it('scopes findByGymId to the specified gym_id', async () => {
      const mockDb = createMockDb();
      const repo = new LicenseRepository(mockDb, GYM_ALPHA);
      await repo.findByGymId(GYM_ALPHA);

      expect(mockDb.getLastQuery()).toContain('SELECT * FROM licenses WHERE gym_id = ?');
      expect(mockDb.getLastBindings()).toEqual([GYM_ALPHA]);
    });
  });
});
