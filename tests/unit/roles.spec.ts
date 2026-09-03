import { describe, it, expect } from 'vitest';
import { checkRole, jsonError } from '../../apps/api/src/lib/roles';
describe('lib/roles — pure auth helpers', () => {
  const baseCtx = (role: string | null | undefined) => ({
    user: role
      ? {
          id: 1,
          email: 'a@b.c',
          name: 'A',
          role: role as any,
          gymId: 1,
          isOwner: role === 'OWNER',
          permissions: [],
          roleId: null,
        }
      : null,
  });

  describe('checkRole', () => {
    it('returns null when PLATFORM_ADMIN bypasses role restrictions', () => {
      const ctx = baseCtx('PLATFORM_ADMIN');
      expect(checkRole(ctx, ['OWNER'])).toBeNull();
      expect(checkRole(ctx, ['OWNER', 'MANAGER'])).toBeNull();
    });

    it('returns null when role matches allowed list', () => {
      expect(checkRole(baseCtx('OWNER'), ['OWNER'])).toBeNull();
      expect(checkRole(baseCtx('MANAGER'), ['OWNER', 'MANAGER'])).toBeNull();
    });

    it('returns 403 when role is not in allowed list', () => {
      const err = checkRole(baseCtx('MANAGER'), ['OWNER']);
      expect(err).not.toBeNull();
      expect((err as Response).status).toBe(403);
    });

    it('returns 401 when user is missing', () => {
      const err = checkRole(baseCtx(null), ['OWNER']);
      expect(err).not.toBeNull();
      expect((err as Response).status).toBe(401);
    });

    it('returns 401 when user is undefined', () => {
      const err = checkRole({}, ['OWNER']);
      expect(err).not.toBeNull();
      expect((err as Response).status).toBe(401);
    });
  });

  describe('jsonError', () => {
    it('returns a JSON response with the given status and message', async () => {
      const res = jsonError('oops', 418);
      expect(res.status).toBe(418);
      expect(res.headers.get('Content-Type')).toBe('application/json');
      const body = await res.json();
      expect(body).toEqual({ error: 'oops' });
    });

    it('merges extra fields when provided', async () => {
      const res = jsonError('forbidden', 403, { code: 'INSUFFICIENT_PERMISSIONS', action: 'member.delete' });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toEqual({ error: 'forbidden', code: 'INSUFFICIENT_PERMISSIONS', action: 'member.delete' });
    });
  });
});