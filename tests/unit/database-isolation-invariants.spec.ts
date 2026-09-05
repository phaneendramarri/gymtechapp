import { describe, it, expect, vi } from 'vitest';
import { AttendanceRepository } from '../../apps/api/src/repositories/attendance.repository';
import { PlanRepository } from '../../apps/api/src/repositories/plan.repository';
import { PaymentRepository } from '../../apps/api/src/repositories/payment.repository';
import { MembershipRepository } from '../../apps/api/src/repositories/membership.repository';
import { MemberRepository } from '../../apps/api/src/repositories/member.repository';
import { LicenseRepository } from '../../apps/api/src/repositories/license.repository';

describe('Multi-Tenant Database Isolation Invariants', () => {
  /**
   * Creates a mock DB that supports both Drizzle query builder (this.db.select...)
   * and raw D1 (this.d1.prepare...). The mock has .prepare so createDatabase wraps it,
   * but capture methods are stored on the d1 object itself so they're accessible
   * via repo.db (the wrapped version) since createDatabase uses the d1 reference.
   *
   * For Drizzle's .get() path (limit(1) without fields): stmt.bind().all().then(r => r.results[0])
   * So .all() must return { results: [mappedRow] } where mappedRow has { status, deletedAt }.
   */
  function createMockDb() {
    const capturedQuery = { sql: '', bindings: [] as any[] };

    const mockDb: any = {
      query: {},
      prepare: (query: string) => {
        capturedQuery.sql = query;
        return {
          bind: (...bindings: any[]) => {
            capturedQuery.bindings = bindings;
            return {
              // raw as property (not method): Drizzle's mapResultRow calls rawFn[0], rawFn[1]
              // for column values. Must return D1 column-value array format.
              get raw() { return () => [['ACTIVE', null]]; },
              all: () => Promise.resolve({ results: [] }),
              get: () => Promise.resolve(undefined),
              first: () => Promise.resolve(undefined),
              run: () => Promise.resolve({ success: true, meta: { last_row_id: 1 } }),
            };
          },
        };
      },
      // Stored directly on the mock so createDatabase-wrapped version can access them
      getLastQuery: () => capturedQuery.sql,
      getLastBindings: () => capturedQuery.bindings,
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

      expect(mockDb.getLastQuery()).toMatch(/gym_id["\s]*=\s*\?/i);
      expect(mockDb.getLastBindings()[0]).toBe(GYM_ALPHA);
    });

    it('scopes checkIn recording to the specific gym_id', async () => {
      const mockDb = createMockDb();
      const repo = new AttendanceRepository(mockDb, GYM_ALPHA);
      await repo.checkIn({ memberId: 55, method: 'QR' });

      expect(mockDb.getLastBindings()).toContain(GYM_ALPHA);
    });
  });

  describe('PlanRepository Isolation', () => {
    it('scopes listActive to gym_id and ignores other gym plans', async () => {
      const mockDb = createMockDb();
      const repo = new PlanRepository(mockDb, GYM_ALPHA);
      await repo.listActive();

      expect(mockDb.getLastQuery()).toMatch(/gym_id["\s]*=\s*\?/i);
      expect(mockDb.getLastBindings()).toContain(GYM_ALPHA);
    });

    it('scopes findById to gym_id preventing cross-tenant plan retrieval', async () => {
      const mockDb = createMockDb();
      const repo = new PlanRepository(mockDb, GYM_ALPHA);
      await repo.findById(99);

      expect(mockDb.getLastQuery()).toMatch(/id["\s]*=\s*\?.*gym_id["\s]*=\s*\?/i);
      expect(mockDb.getLastBindings()).toContain(99);
      expect(mockDb.getLastBindings()).toContain(GYM_ALPHA);
    });

    it('scopes update mutation to gym_id', async () => {
      const mockDb = createMockDb();
      const repo = new PlanRepository(mockDb, GYM_ALPHA);

      await repo.update(42, { name: 'New Plan Name', isActive: 0 });
      expect(mockDb.getLastQuery()).toMatch(/id["\s]*=\s*\?.*gym_id["\s]*=\s*\?/i);
      expect(mockDb.getLastBindings()).toContain(GYM_ALPHA);
    });
  });

  describe('MemberRepository Isolation & Safe Mutations', () => {
    it('scopes list to target gym_id', async () => {
      const mockDb = createMockDb();
      const repo = new MemberRepository(mockDb, GYM_ALPHA);
      await repo.list({});

      expect(mockDb.getLastQuery()).toMatch(/gym_id["\s]*=\s*(\?|101)/i);
      expect(mockDb.getLastBindings()).toBeDefined();
    });

    it('scopes update mutation to target gym_id', async () => {
      const mockDb = createMockDb();
      const repo = new MemberRepository(mockDb, GYM_ALPHA);
      await repo.update(123, { phone: '9999999999', status: 'BLOCKED' });

      expect(mockDb.getLastQuery()).toMatch(/id["\s]*=\s*\?.*gym_id["\s]*=\s*\?/i);
      expect(mockDb.getLastBindings()).toContain(GYM_ALPHA);
    });

    it('scopes findByIdentifier lookup to gym_id so phone/code collisions across gyms do not leak data', async () => {
      const mockDb = createMockDb();
      const repo = new MemberRepository(mockDb, GYM_ALPHA);
      await repo.findByIdentifier('9876543210');

      expect(mockDb.getLastQuery()).toMatch(/gym_id["\s]*=\s*\?/i);
      expect(mockDb.getLastBindings()[0]).toBe(GYM_ALPHA);
    });

    it('scopes getTodayAttendance to gym_id', async () => {
      const mockDb = createMockDb();
      const repo = new MemberRepository(mockDb, GYM_ALPHA);
      await repo.getTodayAttendance();

      expect(mockDb.getLastQuery()).toMatch(/gym_id["\s]*=\s*\?/i);
      expect(mockDb.getLastBindings()[0]).toBe(GYM_ALPHA);
    });
  });

  describe('PaymentRepository Isolation', () => {
    it('scopes next receipt number sequence strictly to current gym_id', async () => {
      const mockDb = createMockDb();
      const repo = new PaymentRepository(mockDb, GYM_ALPHA);
      await repo.getNextReceiptNumber();

      // H4 fix: now uses atomic counters table instead of count(*) on payments
      expect(mockDb.getLastQuery()).toMatch(/counters/i);
      expect(mockDb.getLastBindings()).toEqual([GYM_ALPHA]);
    });

    it('scopes summary metrics to gym_id', async () => {
      const mockDb = createMockDb();
      const repo = new PaymentRepository(mockDb, GYM_BETA);
      await repo.getSummaryMetrics();

      expect(mockDb.getLastQuery()).toMatch(/gym_id["\s]*=\s*\?/i);
      expect(mockDb.getLastBindings()).toContain(GYM_BETA);
    });
  });

  describe('LicenseRepository Isolation', () => {
    it('scopes findByGymId to the specified gym_id', async () => {
      const mockDb = createMockDb();
      const repo = new LicenseRepository(mockDb, GYM_ALPHA);
      await repo.findByGymId(GYM_ALPHA);

      expect(mockDb.getLastQuery()).toMatch(/licenses.*gym_id["\s]*=\s*\?/i);
      expect(mockDb.getLastBindings()).toContain(GYM_ALPHA);
    });
  });
});
