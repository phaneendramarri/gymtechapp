import { describe, it, expect, vi } from 'vitest';
import { MemberRepository } from '../../apps/api/src/repositories/member.repository';
import { AttendanceRepository } from '../../apps/api/src/repositories/attendance.repository';
import { PaymentRepository } from '../../apps/api/src/repositories/payment.repository';
import { MembershipRepository } from '../../apps/api/src/repositories/membership.repository';
import { UserRepository } from '../../apps/api/src/repositories/user.repository';
import { MemberService } from '../../apps/api/src/services/member.service';
import { DashboardService } from '../../apps/api/src/services/dashboard.service';
import { LicenseService } from '../../apps/api/src/services/license.service';

function createMockDb() {
  const statements: { sql: string; bindings: any[] }[] = [];

  const mockDb: any = {
    prepare: (query: string) => {
      const stmtRecord = { sql: query, bindings: [] as any[] };
      statements.push(stmtRecord);

      return {
        bind: (...bindings: any[]) => {
          stmtRecord.bindings = bindings;
          return {
            get raw() { return () => [['ACTIVE', null, 1, 1]]; },
            all: () => Promise.resolve({
              results: [
                {
                  id: 1,
                  gym_id: 101,
                  first_name: 'Jane',
                  last_name: 'Doe',
                  phone: '9876543210',
                  member_code: 'MEM-1001',
                  status: 'ACTIVE',
                  created_at: 1700000000,
                  active_membership_id: 10,
                  membership_status: 'ACTIVE',
                  membership_start_date: 1700000000,
                  membership_end_date: 1705000000,
                  membership_due_amount_paise: 0,
                  plan_name: 'Annual Gold',
                },
              ],
            }),
            get: () => Promise.resolve({ id: 1, status: 'ACTIVE', deletedAt: null }),
            first: () => Promise.resolve({ count: 1, id: 1, max_members: 100, next_val: 1, c: 1, revenue: 50000, total_dues: 0 }),
            run: () => Promise.resolve({ success: true, meta: { last_row_id: 1, changes: 1 } }),
          };
        },
      };
    },
    getStatements: () => statements,
    getLastStatement: () => statements[statements.length - 1],
  };

  return mockDb;
}

describe('Production Hardening & System Invariants', () => {
  const GYM_ID = 101;
  const USER_ID = 42;

  describe('SQL Injection Resilience & Parameterization', () => {
    it('uses parameterized bindings for status and search terms in MemberRepository.countTotal', async () => {
      const mockDb = createMockDb();
      const repo = new MemberRepository(mockDb, GYM_ID);

      const maliciousStatus = "' OR '1'='1";
      const maliciousSearch = "' OR 1=1; DROP TABLE members; --";

      await repo.countTotal({ status: maliciousStatus, search: maliciousSearch });

      const lastStmt = mockDb.getLastStatement();
      expect(lastStmt.sql).not.toContain(maliciousStatus);
      expect(lastStmt.sql).not.toContain(maliciousSearch);
      expect(lastStmt.sql).toContain('gym_id = ?');
      expect(lastStmt.sql).toContain('status = ?');
      expect(lastStmt.sql).toContain('first_name LIKE ?');
      expect(lastStmt.bindings).toContain(GYM_ID);
      expect(lastStmt.bindings).toContain(maliciousStatus);
      expect(lastStmt.bindings).toContain(`%${maliciousSearch}%`);
    });

    it('uses parameterized bindings for status and search in MemberRepository.list', async () => {
      const mockDb = createMockDb();
      const repo = new MemberRepository(mockDb, GYM_ID);

      const maliciousStatus = "' OR '1'='1";
      const maliciousSearch = "' OR 1=1 --";

      const list = await repo.list({ status: maliciousStatus, search: maliciousSearch, limit: 10, offset: 0 });

      const lastStmt = mockDb.getLastStatement();
      expect(lastStmt.sql).not.toContain(maliciousStatus);
      expect(lastStmt.sql).not.toContain(maliciousSearch);
      expect(lastStmt.bindings).toContain(GYM_ID);
      expect(lastStmt.bindings).toContain(maliciousStatus);
      expect(lastStmt.bindings).toContain(`%${maliciousSearch}%`);

      // Verify camelCase & snake_case dual properties mapping
      expect(list[0].firstName).toBe('Jane');
      expect(list[0].first_name).toBe('Jane');
      expect(list[0].memberCode).toBe('MEM-1001');
      expect(list[0].member_code).toBe('MEM-1001');
      expect(list[0].planName).toBe('Annual Gold');
      expect(list[0].plan_name).toBe('Annual Gold');
    });
  });

  describe('Attendance Queries Invariant', () => {
    it('queries attendance table for today check-in count with proper gym isolation', async () => {
      const mockDb = createMockDb();
      const repo = new AttendanceRepository(mockDb, GYM_ID);

      await repo.countToday();

      const lastStmt = mockDb.getLastStatement();
      expect(lastStmt.sql.toLowerCase()).toContain('from "attendance"');
      expect(lastStmt.sql.toLowerCase()).toContain('count(*)');
      expect(lastStmt.bindings).toContain(GYM_ID);
    });

    it('member repository getTodayAttendance queries attendance table', async () => {
      const mockDb = createMockDb();
      const repo = new MemberRepository(mockDb, GYM_ID);

      await repo.getTodayAttendance();

      const lastStmt = mockDb.getLastStatement();
      expect(lastStmt.sql.toLowerCase()).toContain('from "attendance"');
      expect(lastStmt.bindings).toContain(GYM_ID);
    });
  });

  describe('Payment Repository Soft-Delete Invariant', () => {
    it('filters soft-deleted records in list and count', async () => {
      const mockDb = createMockDb();
      const repo = new PaymentRepository(mockDb, GYM_ID);

      await repo.list({ limit: 10 });
      let stmt = mockDb.getLastStatement();
      expect(stmt.sql.toLowerCase()).toContain('deleted_at');

      await repo.count();
      stmt = mockDb.getLastStatement();
      expect(stmt.sql.toLowerCase()).toContain('deleted_at');
    });
  });

  describe('License & Membership Expiry Sweep', () => {
    it('updates status to EXPIRED for past-expiry licenses and memberships', async () => {
      const mockDb = createMockDb();
      const licenseService = new LicenseService(mockDb, GYM_ID);

      const res = await licenseService.sweepExpiries();

      const stmts = mockDb.getStatements();
      const updateLic = stmts.find((s) => s.sql.includes('UPDATE licenses SET status = \'EXPIRED\''));
      const updateMem = stmts.find((s) => s.sql.includes('UPDATE memberships SET status = \'EXPIRED\''));

      expect(updateLic).toBeDefined();
      expect(updateMem).toBeDefined();
      expect(updateLic!.bindings).toContain(GYM_ID);
      expect(updateMem!.bindings).toContain(GYM_ID);
      expect(res.expiredLicenses).toBe(1);
      expect(res.expiredMemberships).toBe(1);
    });
  });

  describe('Platform Admin User Invariant', () => {
    it('updates user status column on account disable/enable', async () => {
      const mockDb = createMockDb();
      const userRepo = new UserRepository(mockDb);

      await userRepo.update(10, { status: 'DISABLED' });
      let stmt = mockDb.getLastStatement();
      expect(stmt.sql).toMatch(/UPDATE "users" SET/i);
      expect(stmt.sql).toContain('status');
      expect(stmt.bindings).toContain('DISABLED');

      await userRepo.update(10, { status: 'ACTIVE' });
      stmt = mockDb.getLastStatement();
      expect(stmt.bindings).toContain('ACTIVE');
    });
  });
});
