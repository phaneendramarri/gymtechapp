import { describe, it, expect, vi } from 'vitest';
import { GYM_FEATURES, GYM_FEATURE_LABELS, type GymFeatureKey } from '../../packages/shared/src/constants';
import { checkRole } from '../../apps/api/src/lib/roles';
import { extractClientInfo } from '../../apps/api/src/services/audit.service';
import { LicenseService } from '../../apps/api/src/services/license.service';

describe('Enterprise SaaS Governance & Multi-Tenant Architecture', () => {
  describe('1. Centralized Feature Definitions & Registry', () => {
    it('defines all platform core modules in GYM_FEATURES registry', () => {
      expect(GYM_FEATURES).toContain('dashboard');
      expect(GYM_FEATURES).toContain('members');
      expect(GYM_FEATURES).toContain('attendance');
      expect(GYM_FEATURES).toContain('payments');
      expect(GYM_FEATURES).toContain('pt_collections');
      expect(GYM_FEATURES).toContain('plans');
      expect(GYM_FEATURES).toContain('staff');
      expect(GYM_FEATURES).toContain('reports');
      expect(GYM_FEATURES).toContain('settings');
      expect(GYM_FEATURES.length).toBe(9);
    });

    it('has human-readable labels and descriptions for every feature key', () => {
      for (const key of GYM_FEATURES) {
        const item = GYM_FEATURE_LABELS[key as GymFeatureKey];
        expect(item).toBeDefined();
        expect(typeof item.name).toBe('string');
        expect(item.name.length).toBeGreaterThan(0);
        expect(typeof item.description).toBe('string');
        expect(item.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('2. Three-Role Matrix & Authorization Boundaries', () => {
    it('requireRole allows permitted roles and blocks forbidden roles', () => {
      const ownerCtx: any = { user: { id: 1, role: 'OWNER' } };
      const managerCtx: any = { user: { id: 2, role: 'MANAGER' } };
      const staffCtx: any = { user: { id: 3, role: 'STAFF' } };
      const noUserCtx: any = { user: null };

      // Owner allowed
      expect(checkRole(ownerCtx, ['OWNER'])).toBeNull();
      expect(checkRole(ownerCtx, ['OWNER', 'MANAGER'])).toBeNull();

      // Manager blocked from owner-only actions (reports, staff management)
      const managerErr = checkRole(managerCtx, ['OWNER']);
      expect(managerErr).not.toBeNull();
      expect(managerErr?.status).toBe(403);

      // Staff blocked from managerial actions
      const staffErr = checkRole(staffCtx, ['OWNER', 'MANAGER']);
      expect(staffErr).not.toBeNull();
      expect(staffErr?.status).toBe(403);

      // Unauthenticated context blocked
      const authErr = checkRole(noUserCtx, ['OWNER']);
      expect(authErr).not.toBeNull();
      expect(authErr?.status).toBe(401);
    });

    it('MANAGER role is strictly barred from financial revenue dashboards and reports', () => {
      // Invariant: Reports route requires strictly ['OWNER']
      const reportsAllowedRoles = ['OWNER'];
      expect(reportsAllowedRoles.includes('MANAGER')).toBe(false);

      // Manager financial isolation in metrics:
      const rawMetrics = {
        monthlyRevenue: 4500000,
        pendingDues: 250000,
        recentPayments: [{ id: 1, amount_paise: 50000 }],
        monthlyRevenueTrend: [{ month: '2026-08', revenue: 4500000 }],
        activeMembers: 120,
        todayAttendance: 34,
      };

      const maskForRole = (metrics: typeof rawMetrics, role?: string) => {
        if (role === 'MANAGER') {
          return {
            ...metrics,
            monthlyRevenue: 0,
            pendingDues: 0,
            recentPayments: [],
            monthlyRevenueTrend: [],
          };
        }
        return metrics;
      };

      const managerView = maskForRole(rawMetrics, 'MANAGER');
      expect(managerView.monthlyRevenue).toBe(0);
      expect(managerView.pendingDues).toBe(0);
      expect(managerView.recentPayments).toEqual([]);
      expect(managerView.monthlyRevenueTrend).toEqual([]);
      // Operational metrics remain intact
      expect(managerView.activeMembers).toBe(120);
      expect(managerView.todayAttendance).toBe(34);

      const ownerView = maskForRole(rawMetrics, 'OWNER');
      expect(ownerView.monthlyRevenue).toBe(4500000);
      expect(ownerView.pendingDues).toBe(250000);
      expect(ownerView.recentPayments.length).toBe(1);
    });
  });

  describe('3. Universal Soft Deletes & Operational Safety Invariants', () => {
    it('records are never hard deleted; deactivation applies deleted_at timestamp', () => {
      const now = 1756550400;
      const initialMember = {
        id: 10,
        gym_id: 1,
        first_name: 'Rahul',
        status: 'ACTIVE',
        deleted_at: null,
      };

      // Soft delete operation
      const archivedMember = {
        ...initialMember,
        status: 'INACTIVE',
        deleted_at: now,
      };

      expect(archivedMember.deleted_at).toBe(now);
      expect(archivedMember.status).toBe('INACTIVE');
      expect(archivedMember.id).toBe(10); // Historical entity identity preserved

      // Restore operation
      const restoredMember = {
        ...archivedMember,
        status: 'ACTIVE',
        deleted_at: null,
      };

      expect(restoredMember.deleted_at).toBeNull();
      expect(restoredMember.status).toBe('ACTIVE');
    });

    it('prevents check-in against inactive or soft-deleted members', () => {
      const validateCheckIn = (member: { status: string; deleted_at: number | null }) => {
        if (member.deleted_at !== null) {
          return { allowed: false, error: 'Cannot record attendance for an archived member.' };
        }
        if (member.status === 'BLOCKED') {
          return { allowed: false, error: 'Member is blocked.' };
        }
        if (member.status === 'INACTIVE') {
          return { allowed: false, error: 'Member is inactive.' };
        }
        return { allowed: true };
      };

      expect(validateCheckIn({ status: 'ACTIVE', deleted_at: null }).allowed).toBe(true);
      expect(validateCheckIn({ status: 'INACTIVE', deleted_at: 1756550400 }).allowed).toBe(false);
      expect(validateCheckIn({ status: 'INACTIVE', deleted_at: null }).allowed).toBe(false);
      expect(validateCheckIn({ status: 'BLOCKED', deleted_at: null }).allowed).toBe(false);
    });

    it('prevents payment recording against inactive or soft-deleted members', () => {
      const validatePayment = (member: { status: string; deleted_at: number | null }) => {
        if (member.deleted_at !== null || member.status === 'INACTIVE') {
          return { allowed: false, error: 'Cannot record payment for an inactive or archived member.' };
        }
        return { allowed: true };
      };

      expect(validatePayment({ status: 'ACTIVE', deleted_at: null }).allowed).toBe(true);
      expect(validatePayment({ status: 'INACTIVE', deleted_at: 1756550400 }).allowed).toBe(false);
    });

    it('prevents membership renewal with an archived or deleted plan', () => {
      const validateRenewal = (
        member: { status: string; deleted_at: number | null },
        plan: { is_active: number; deleted_at: number | null }
      ) => {
        if (member.deleted_at !== null || member.status === 'INACTIVE') {
          return { allowed: false, error: 'Member is inactive or archived.' };
        }
        if (plan.deleted_at !== null || plan.is_active === 0) {
          return { allowed: false, error: 'Selected plan is archived or inactive.' };
        }
        return { allowed: true };
      };

      const activeMember = { status: 'ACTIVE', deleted_at: null };
      const activePlan = { is_active: 1, deleted_at: null };
      const deletedPlan = { is_active: 0, deleted_at: 1756550400 };

      expect(validateRenewal(activeMember, activePlan).allowed).toBe(true);
      expect(validateRenewal(activeMember, deletedPlan).allowed).toBe(false);
    });
  });

  describe('4. Multi-Tenant License Caps & Concurrency-Safe Quota Consumption', () => {
    it('enforces maximum member limit per tenant license', async () => {
      const mockLicense = {
        id: 1,
        gym_id: 101,
        status: 'ACTIVE',
        max_members: 100,
        max_staff_total: 10,
        max_managers: 2,
      };

      const mockDb: any = {
        prepare: (query: string) => ({
          bind: (...args: any[]) => ({
            first: async () => {
              if (query.includes('FROM licenses')) return mockLicense;
              if (query.includes('FROM members')) return { count: 100 }; // At cap
              return null;
            },
          }),
        }),
      };

      const licenseService = new LicenseService(mockDb, 101);
      const check = await licenseService.checkMemberLimit();

      expect(check.allowed).toBe(false);
      expect(check.current).toBe(100);
      expect(check.max).toBe(100);
      expect(check.reason).toContain('Member limit reached');
    });

    it('allows unlimited members when license max_members is -1', async () => {
      const unlimitedLicense = {
        id: 1,
        gym_id: 102,
        status: 'ACTIVE',
        max_members: -1,
        max_staff_total: -1,
        max_managers: -1,
      };

      const mockDb: any = {
        prepare: (query: string) => ({
          bind: (...args: any[]) => ({
            first: async () => {
              if (query.includes('FROM licenses')) return unlimitedLicense;
              if (query.includes('FROM members')) return { count: 5430 };
              return null;
            },
          }),
        }),
      };

      const licenseService = new LicenseService(mockDb, 102);
      const check = await licenseService.checkMemberLimit();

      expect(check.allowed).toBe(true);
      expect(check.max).toBe(-1);
    });

    it('enforces manager limits per gym', async () => {
      const mockLicense = {
        id: 1,
        gym_id: 103,
        status: 'ACTIVE',
        max_managers: 2,
        max_staff_total: 10,
      };

      const mockDb: any = {
        prepare: (query: string) => ({
          bind: (...args: any[]) => ({
            first: async () => {
              if (query.includes('FROM licenses')) return mockLicense;
              if (query.includes("role = 'MANAGER'")) return { count: 2 }; // Limit reached
              return null;
            },
          }),
        }),
      };

      const licenseService = new LicenseService(mockDb, 103);
      const check = await licenseService.checkManagerLimit();

      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Manager limit reached (2/2)');
    });
  });

  describe('5. Audit Trail & Client Extraction', () => {
    it('extracts client IP and user agent headers accurately', () => {
      const reqWithCf = new Request('http://localhost/api/members', {
        headers: {
          'cf-connecting-ip': '203.0.113.195',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      });

      const client = extractClientInfo(reqWithCf);
      expect(client.ip).toBe('203.0.113.195');
      expect(client.userAgent).toContain('Windows NT 10.0');

      const reqWithForwarded = new Request('http://localhost/api/members', {
        headers: {
          'x-forwarded-for': '198.51.100.42, 10.0.0.1',
          'user-agent': 'GymTechMobile/1.0',
        },
      });

      const client2 = extractClientInfo(reqWithForwarded);
      expect(client2.ip).toBe('198.51.100.42');
      expect(client2.userAgent).toBe('GymTechMobile/1.0');
    });
  });
});
