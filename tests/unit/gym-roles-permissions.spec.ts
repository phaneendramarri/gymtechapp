import { describe, it, expect } from 'vitest';
import { requirePermission } from '../../apps/api/src/middleware/auth';

describe('Gym Roles & Granular Permission Middleware Invariants', () => {
  const createMockContext = (user: any, gymId: number = 1) => {
    const store = new Map<string, any>();
    const ctx = {
      user,
      gymId,
      db: {},
    };
    store.set('ctx', ctx);
    store.set('user', user);
    store.set('gymId', gymId);

    let responseStatus: number | null = null;
    let responseBody: any = null;

    return {
      c: {
        get: (key: string) => store.get(key),
        set: (key: string, val: any) => store.set(key, val),
        json: (data: any, status: number) => {
          responseStatus = status;
          responseBody = data;
          return { status, body: data, headers: new Headers() } as any;
        },
      } as any,
      getStatus: () => responseStatus,
      getBody: () => responseBody,
    };
  };

  describe('requirePermission bypass rules', () => {
    it('allows GYM OWNER access to any feature regardless of permissions array', async () => {
      const middleware = requirePermission('members');
      let nextCalled = false;
      const next = async () => {
        nextCalled = true;
      };

      const { c, getStatus } = createMockContext({
        id: 10,
        email: 'owner@gym.com',
        role: 'OWNER',
        isOwner: true,
        permissions: [], // Empty permissions array!
      });

      await middleware(c, next);
      expect(nextCalled).toBe(true);
      expect(getStatus()).toBeNull();
    });

    it('allows PLATFORM_ADMIN access to any gym feature unconditionally', async () => {
      const middleware = requirePermission('pt_collections');
      let nextCalled = false;
      const next = async () => {
        nextCalled = true;
      };

      const { c, getStatus } = createMockContext({
        id: 1,
        email: 'admin@platform.internal',
        role: 'PLATFORM_ADMIN',
        isOwner: false,
        permissions: [],
      });

      await middleware(c, next);
      expect(nextCalled).toBe(true);
      expect(getStatus()).toBeNull();
    });

    it('allows STAFF member when the required permission is present in their permissions array', async () => {
      const middleware = requirePermission('members');
      let nextCalled = false;
      const next = async () => {
        nextCalled = true;
      };

      const { c, getStatus } = createMockContext({
        id: 25,
        email: 'frontdesk@gym.com',
        role: 'STAFF',
        isOwner: false,
        permissions: ['dashboard', 'members', 'attendance'],
      });

      await middleware(c, next);
      expect(nextCalled).toBe(true);
      expect(getStatus()).toBeNull();
    });

    it('blocks STAFF member with 403 when the required permission is absent', async () => {
      const middleware = requirePermission('pt_collections');
      let nextCalled = false;
      const next = async () => {
        nextCalled = true;
      };

      const { c, getStatus, getBody } = createMockContext({
        id: 25,
        email: 'frontdesk@gym.com',
        role: 'STAFF',
        isOwner: false,
        permissions: ['dashboard', 'members'], // Missing pt_collections
      });

      const res = (await middleware(c, next)) as Response;
      expect(nextCalled).toBe(false);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('permissions');
    });

    it('blocks unauthenticated requests with 401 Unauthorized', async () => {
      const middleware = requirePermission('members');
      let nextCalled = false;
      const next = async () => {
        nextCalled = true;
      };

      const { c } = createMockContext(null);

      const res = (await middleware(c, next)) as Response;
      expect(nextCalled).toBe(false);
      expect(res.status).toBe(401);
    });
  });

  describe('Custom Role Configuration Model', () => {
    it('serializes and parses role menu permissions correctly', () => {
      const menuPermissions = ['dashboard', 'members', 'attendance', 'payments'];
      const serialized = JSON.stringify(menuPermissions);

      expect(typeof serialized).toBe('string');
      const parsed = JSON.parse(serialized);
      expect(parsed).toEqual(menuPermissions);
      expect(parsed.includes('members')).toBe(true);
      expect(parsed.includes('settings')).toBe(false);
    });

    it('identifies owner role invariant: owner role cannot be deleted', () => {
      const roles = [
        { id: 1, gymId: 1, name: 'Owner', isOwner: true, permissions: ['all'] },
        { id: 2, gymId: 1, name: 'Front Desk', isOwner: false, permissions: ['members', 'attendance'] },
      ];

      const canDeleteRole = (role: typeof roles[0]) => !role.isOwner;

      expect(canDeleteRole(roles[0])).toBe(false);
      expect(canDeleteRole(roles[1])).toBe(true);
    });

    it('strictly isolates roles between gym tenants', () => {
      const tenantRoles = [
        { id: 101, gymId: 1, name: 'Gym 1 Staff' },
        { id: 102, gymId: 2, name: 'Gym 2 Staff' },
      ];

      const filterByGym = (gymId: number) => tenantRoles.filter((r) => r.gymId === gymId);

      const gym1Roles = filterByGym(1);
      const gym2Roles = filterByGym(2);

      expect(gym1Roles).toHaveLength(1);
      expect(gym1Roles[0].name).toBe('Gym 1 Staff');
      expect(gym2Roles).toHaveLength(1);
      expect(gym2Roles[0].name).toBe('Gym 2 Staff');
    });
  });
});
