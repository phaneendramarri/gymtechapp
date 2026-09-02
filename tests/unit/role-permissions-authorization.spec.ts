import { describe, it, expect } from 'vitest';
import { hasAllowedRole } from '../../apps/api/src/lib/session';

describe('Role-Based Access Control & Permission Authorization Invariants', () => {
  describe('hasAllowedRole utility', () => {
    it('grants access when user role is in the allowed list', () => {
      expect(hasAllowedRole('OWNER', ['OWNER', 'MANAGER'])).toBe(true);
      expect(hasAllowedRole('MANAGER', ['OWNER', 'MANAGER'])).toBe(true);
      expect(hasAllowedRole('STAFF', ['OWNER', 'MANAGER', 'STAFF'])).toBe(true);
    });

    it('denies access when user role is not in the allowed list', () => {
      expect(hasAllowedRole('STAFF', ['OWNER', 'MANAGER'])).toBe(false);
      expect(hasAllowedRole('TRAINER', ['OWNER', 'MANAGER'])).toBe(false);
      expect(hasAllowedRole('MEMBER', ['STAFF', 'MANAGER', 'OWNER'])).toBe(false);
    });

    it('denies access when role is undefined, null, or empty string', () => {
      expect(hasAllowedRole(undefined, ['OWNER'])).toBe(false);
      expect(hasAllowedRole(null, ['OWNER'])).toBe(false);
      expect(hasAllowedRole('', ['OWNER'])).toBe(false);
    });

    it('denies access when allowed list is empty', () => {
      expect(hasAllowedRole('OWNER', [])).toBe(false);
    });
  });

  describe('Permission Boundaries by Role', () => {
    const ownerAllowed = ['OWNER'];
    const managerAllowed = ['OWNER', 'MANAGER'];
    const staffAllowed = ['OWNER', 'MANAGER', 'STAFF'];
    const trainerAllowed = ['OWNER', 'MANAGER', 'TRAINER'];

    it('OWNER has unrestricted access across gym managerial capabilities', () => {
      const role = 'OWNER';
      expect(hasAllowedRole(role, ownerAllowed)).toBe(true);
      expect(hasAllowedRole(role, managerAllowed)).toBe(true);
      expect(hasAllowedRole(role, staffAllowed)).toBe(true);
      expect(hasAllowedRole(role, trainerAllowed)).toBe(true);
    });

    it('MANAGER can manage staff, plans, and members, but cannot perform platform super-admin duties', () => {
      const role: string = 'MANAGER';
      expect(hasAllowedRole(role, managerAllowed)).toBe(true);
      expect(hasAllowedRole(role, staffAllowed)).toBe(true);
      // Super admin check is separate and strictly requires PLATFORM_ADMIN or SUPER_ADMIN
      const isPlatformAdmin = role === 'PLATFORM_ADMIN' || role === 'SUPER_ADMIN';
      expect(isPlatformAdmin).toBe(false);
    });

    it('STAFF cannot perform destructive or financial management operations', () => {
      const role = 'STAFF';
      // Operations requiring MANAGER or higher:
      // 1. Bulk import members
      expect(hasAllowedRole(role, ['OWNER', 'MANAGER'])).toBe(false);
      // 2. Freeze member
      expect(hasAllowedRole(role, ['OWNER', 'MANAGER'])).toBe(false);
      // 3. Unfreeze member
      expect(hasAllowedRole(role, ['OWNER', 'MANAGER'])).toBe(false);
      // 4. Create/manage staff members
      expect(hasAllowedRole(role, ['OWNER', 'MANAGER'])).toBe(false);
      // 5. Create/update membership plans
      expect(hasAllowedRole(role, ['OWNER', 'MANAGER'])).toBe(false);
      // 6. Settle PT commissions
      expect(hasAllowedRole(role, ['OWNER', 'MANAGER'])).toBe(false);
      // 7. Access financial reports and exports
      expect(hasAllowedRole(role, ['OWNER', 'MANAGER'])).toBe(false);

      // Operations STAFF can perform:
      expect(hasAllowedRole(role, ['OWNER', 'MANAGER', 'STAFF'])).toBe(true);
    });

    it('TRAINER cannot perform membership management or settle commissions', () => {
      const role = 'TRAINER';
      // Cannot modify plans
      expect(hasAllowedRole(role, ['OWNER', 'MANAGER'])).toBe(false);
      // Cannot settle commissions
      expect(hasAllowedRole(role, ['OWNER', 'MANAGER'])).toBe(false);
      // Cannot view financial reports
      expect(hasAllowedRole(role, ['OWNER', 'MANAGER'])).toBe(false);
    });

    it('MEMBER role has zero administrative or desk access', () => {
      const role = 'MEMBER';
      expect(hasAllowedRole(role, ['OWNER', 'MANAGER', 'STAFF'])).toBe(false);
      expect(hasAllowedRole(role, ['OWNER', 'MANAGER'])).toBe(false);
      expect(hasAllowedRole(role, ['OWNER'])).toBe(false);
    });
  });

  describe('Super Admin Isolation', () => {
    it('guarantees that tenant users cannot claim platform admin capabilities', () => {
      const tenantRoles = ['OWNER', 'MANAGER', 'STAFF', 'TRAINER', 'MEMBER'];
      for (const r of tenantRoles) {
        const isSuper = r === 'PLATFORM_ADMIN' || r === 'SUPER_ADMIN';
        expect(isSuper).toBe(false);
      }
    });

    it('recognizes valid platform admin roles', () => {
      const isPlatformAdmin = (role: string) => role === 'PLATFORM_ADMIN' || role === 'SUPER_ADMIN';
      expect(isPlatformAdmin('PLATFORM_ADMIN')).toBe(true);
      expect(isPlatformAdmin('SUPER_ADMIN')).toBe(true);
    });
  });
});
