import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
} from '../../apps/api/src/lib/session';
// Role policy has one owner: lib/roles.ts (session.ts is token mechanics only).
import {
  hasAllowedRole,
  deriveCoarseRole,
  hasUnrestrictedGymAccess,
} from '../../apps/api/src/lib/roles';

describe('Auth & Cryptographic Security', () => {
  const secret = 'test-secret-key-12345678901234567890';

  it('hashes passwords with PBKDF2-SHA256 (PHC string, salted, non-deterministic)', async () => {
    const hash1 = await hashPassword('admin123');
    const hash2 = await hashPassword('admin123');
    const hashOther = await hashPassword('other123');

    // PBKDF2 output is non-deterministic (random salt) — but verifyPassword
    // must accept both.
    expect(hash1).not.toBe(hash2);
    expect(hash1).toMatch(/^pbkdf2\$sha256:100000\$/);
    expect(hash1).not.toBe(hashOther);
    expect(await verifyPassword('admin123', hash1)).toBe(true);
    expect(await verifyPassword('admin123', hash2)).toBe(true);
    expect(await verifyPassword('other123', hash1)).toBe(false);
  });

  it('verifyPassword returns false for malformed/empty input', async () => {
    const realHash = await hashPassword('admin123');
    expect(await verifyPassword('', realHash)).toBe(false);
    expect(await verifyPassword('admin123', '')).toBe(false);
    expect(await verifyPassword('admin123', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('admin123', 'sha256$tooshort')).toBe(false);
  });

  it('creates and verifies valid session tokens', async () => {
    const user = {
      id: 123,
      email: 'owner@gym.com',
      name: 'Gym Owner',
      role: 'OWNER' as const,
      gymId: 1,
      isOwner: true,
      permissions: ['dashboard', 'members'],
      roleId: null,
    };

    const { token } = await createSessionToken(user, secret, { expiresInSeconds: 3600 });
    expect(token).toBeTruthy();
    expect(token.split('.').length).toBe(3);

    const verified = await verifySessionToken(token, secret);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(user.id);
    expect(verified?.email).toBe(user.email);
    expect(verified?.role).toBe(user.role);
    expect(verified?.gymId).toBe(user.gymId);
  });

  it('rejects expired tokens', async () => {
    const user = {
      id: 456,
      email: 'expired@gym.com',
      name: 'Expired User',
      role: 'MEMBER' as const,
      gymId: 1,
      isOwner: false,
      permissions: [],
      roleId: null,
    };

    // Expire immediately (negative duration, -86400 = 1 day ago regardless of clock)
    const { token } = await createSessionToken(user, secret, { expiresInSeconds: -86400 });
    const verified = await verifySessionToken(token, secret);
    expect(verified).toBeNull();
  });

  it('rejects tokens signed with a different secret', async () => {
    const user = {
      id: 999,
      email: 'forged@gym.com',
      name: 'Forged User',
      role: 'PLATFORM_ADMIN' as const,
      gymId: null,
      isOwner: false,
      permissions: [],
      roleId: null,
    };

    const { token } = await createSessionToken(user, 'secret-a', { expiresInSeconds: 3600 });
    const verified = await verifySessionToken(token, 'secret-b');
    expect(verified).toBeNull();
  });

  it('rejects tampered token payloads', async () => {
    const user = {
      id: 789,
      email: 'normal@gym.com',
      name: 'Normal User',
      role: 'MEMBER' as const,
      gymId: 1,
      isOwner: false,
      permissions: [],
      roleId: null,
    };

    const { token } = await createSessionToken(user, secret, { expiresInSeconds: 3600 });
    const parts = token.split('.');
    // Tamper with middle part (payload)
    const tamperedPayload = btoa(JSON.stringify({ ...user, role: 'PLATFORM_ADMIN', exp: Math.floor(Date.now() / 1000) + 3600 }))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    const verified = await verifySessionToken(tamperedToken, secret);
    expect(verified).toBeNull();
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('allows OWNER and MANAGER on management-only operations', () => {
      const allowedRoles = ['OWNER', 'MANAGER'];

      expect(hasAllowedRole('OWNER', allowedRoles)).toBe(true);
      expect(hasAllowedRole('MANAGER', allowedRoles)).toBe(true);
    });

    it('rejects STAFF, TRAINER, and MEMBER on management-only operations (freeze, plans, staff creation)', () => {
      const allowedRoles = ['OWNER', 'MANAGER'];

      expect(hasAllowedRole('STAFF', allowedRoles)).toBe(false);
      expect(hasAllowedRole('TRAINER', allowedRoles)).toBe(false);
      expect(hasAllowedRole('MEMBER', allowedRoles)).toBe(false);
      expect(hasAllowedRole(undefined, allowedRoles)).toBe(false);
      expect(hasAllowedRole(null, allowedRoles)).toBe(false);
    });

    it('allows front desk STAFF for member management routes', () => {
      const memberStaffRoles = ['OWNER', 'MANAGER', 'STAFF'];

      expect(hasAllowedRole('OWNER', memberStaffRoles)).toBe(true);
      expect(hasAllowedRole('MANAGER', memberStaffRoles)).toBe(true);
      expect(hasAllowedRole('STAFF', memberStaffRoles)).toBe(true);
      expect(hasAllowedRole('TRAINER', memberStaffRoles)).toBe(false);
    });
  });
});
