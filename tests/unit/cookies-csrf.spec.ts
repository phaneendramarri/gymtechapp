// filepath: tests/unit/cookies-csrf.spec.ts
import { describe, it, expect } from 'vitest';
import {
  buildSessionCookie,
  buildClearSessionCookie,
  buildCsrfCookie,
  readCookie,
  COOKIE_NAMES,
  generateCsrfToken,
} from '../../apps/api/src/lib/cookies';

describe('Cookie helpers (Phase 1.2 — JWT in httpOnly cookie)', () => {
  describe('buildSessionCookie', () => {
    it('produces an HttpOnly, SameSite=Lax cookie with the token', () => {
      const cookie = buildSessionCookie('jwt-abc123', 'production');
      expect(cookie).toContain(`${COOKIE_NAMES.SESSION}=jwt-abc123`);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('Secure');
    });

    it('omits Secure flag in development (for HTTP localhost)', () => {
      const cookie = buildSessionCookie('jwt', 'development');
      expect(cookie).not.toContain('Secure');
      expect(cookie).toContain('HttpOnly');
    });

    it('sets Max-Age matching the session lifetime (7 days)', () => {
      const cookie = buildSessionCookie('jwt', 'production');
      expect(cookie).toContain(`Max-Age=${7 * 24 * 60 * 60}`);
    });
  });

  describe('buildClearSessionCookie', () => {
    it('uses Max-Age=0 to clear the session', () => {
      const cookie = buildClearSessionCookie('production');
      expect(cookie).toContain(`${COOKIE_NAMES.SESSION}=`);
      expect(cookie).toContain('Max-Age=0');
      expect(cookie).toContain('HttpOnly');
    });
  });

  describe('buildCsrfCookie', () => {
    it('is NOT HttpOnly (must be readable by JS for double-submit)', () => {
      const cookie = buildCsrfCookie('csrf-abc', 'production');
      expect(cookie).toContain(`${COOKIE_NAMES.CSRF}=csrf-abc`);
      expect(cookie).not.toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Secure');
    });

    it('omits Secure flag in development', () => {
      const cookie = buildCsrfCookie('csrf-abc', 'development');
      expect(cookie).not.toContain('Secure');
    });
  });

  describe('readCookie', () => {
    it('extracts a value by name from a Cookie header', () => {
      const header = 'gym_token=abc; gym_csrf=xyz; other=val';
      expect(readCookie(header, 'gym_token')).toBe('abc');
      expect(readCookie(header, 'gym_csrf')).toBe('xyz');
      expect(readCookie(header, 'other')).toBe('val');
    });

    it('returns null for missing cookies', () => {
      expect(readCookie('foo=bar', 'missing')).toBeNull();
      expect(readCookie(null, 'gym_token')).toBeNull();
      expect(readCookie(undefined, 'gym_token')).toBeNull();
      expect(readCookie('', 'gym_token')).toBeNull();
    });

    it('handles whitespace around the separator', () => {
      expect(readCookie('a=1;  b=2 ; c=3', 'b')).toBe('2');
    });
  });

  describe('generateCsrfToken', () => {
    it('returns a non-empty base64url string', () => {
      const t = generateCsrfToken();
      expect(t).toBeTruthy();
      expect(t.length).toBeGreaterThanOrEqual(40);
      // base64url alphabet only
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('produces different tokens on each call (high entropy)', () => {
      const a = generateCsrfToken();
      const b = generateCsrfToken();
      const c = generateCsrfToken();
      expect(a).not.toBe(b);
      expect(b).not.toBe(c);
      expect(a).not.toBe(c);
    });
  });
});

describe('CSRF double-submit pattern (Phase 1.2)', () => {
  it('session cookie is HttpOnly; CSRF cookie is not', () => {
    const session = buildSessionCookie('jwt', 'production');
    const csrf = buildCsrfCookie('csrf-tok', 'production');
    expect(session).toContain('HttpOnly');
    expect(csrf).not.toContain('HttpOnly');
    // This is the core invariant: the browser auto-attaches the session
    // cookie, but JavaScript must read the CSRF cookie and echo it as a
    // header. Attackers from other origins cannot do that.
  });

  it('CSRF cookie uses SameSite=Lax (cross-site fetch does not auto-attach)', () => {
    const csrf = buildCsrfCookie('csrf-tok', 'production');
    expect(csrf).toContain('SameSite=Lax');
  });

  describe('csrfMiddleware enforcement', () => {
    const createMockContext = (method: string, path: string, headers: Record<string, string> = {}) => {
      let status: number | null = null;
      let body: any = null;
      return {
        c: {
          req: {
            method,
            path,
            header: (name: string) => {
              const lower = name.toLowerCase();
              for (const [k, v] of Object.entries(headers)) {
                if (k.toLowerCase() === lower) return v;
              }
              return undefined;
            },
          },
          json: (data: any, statusCode: number) => {
            status = statusCode;
            body = data;
            return { status, body } as any;
          },
        } as any,
        getStatus: () => status,
        getBody: () => body,
      };
    };

    it('exempts safe methods (GET, HEAD, OPTIONS)', async () => {
      const { csrfMiddleware } = await import('../../apps/api/src/middleware/csrf');
      for (const method of ['GET', 'HEAD', 'OPTIONS']) {
        let nextCalled = false;
        const { c } = createMockContext(method, '/api/members');
        await csrfMiddleware(c, async () => { nextCalled = true; });
        expect(nextCalled).toBe(true);
      }
    });

    it('exempts /api/auth/refresh from CSRF check', async () => {
      const { csrfMiddleware } = await import('../../apps/api/src/middleware/csrf');
      let nextCalled = false;
      const { c } = createMockContext('POST', '/api/auth/refresh', {
        Cookie: `${COOKIE_NAMES.CSRF}=tok123`,
      });
      await csrfMiddleware(c, async () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it('exempts Bearer-authenticated requests from CSRF check', async () => {
      const { csrfMiddleware } = await import('../../apps/api/src/middleware/csrf');
      let nextCalled = false;
      const { c } = createMockContext('POST', '/api/members', {
        Authorization: 'Bearer eyJhbGciOi...',
      });
      await csrfMiddleware(c, async () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it('blocks state-changing request when X-CSRF-Token is missing', async () => {
      const { csrfMiddleware } = await import('../../apps/api/src/middleware/csrf');
      let nextCalled = false;
      const { c, getStatus, getBody } = createMockContext('POST', '/api/members', {
        Cookie: `${COOKIE_NAMES.CSRF}=secret-csrf-val`,
      });
      await csrfMiddleware(c, async () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(getStatus()).toBe(403);
      expect(getBody()?.code).toBe('CSRF_MISSING');
    });

    it('blocks state-changing request when CSRF token does not match', async () => {
      const { csrfMiddleware } = await import('../../apps/api/src/middleware/csrf');
      let nextCalled = false;
      const { c, getStatus, getBody } = createMockContext('POST', '/api/members', {
        Cookie: `${COOKIE_NAMES.CSRF}=valid-token`,
        'X-CSRF-Token': 'wrong-token',
      });
      await csrfMiddleware(c, async () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(getStatus()).toBe(403);
      expect(getBody()?.code).toBe('CSRF_MISMATCH');
    });

    it('allows request when CSRF cookie and X-CSRF-Token match exactly', async () => {
      const { csrfMiddleware } = await import('../../apps/api/src/middleware/csrf');
      let nextCalled = false;
      const { c } = createMockContext('POST', '/api/members', {
        Cookie: `${COOKIE_NAMES.CSRF}=secret-matching-token`,
        'X-CSRF-Token': 'secret-matching-token',
      });
      await csrfMiddleware(c, async () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });
  });
});
