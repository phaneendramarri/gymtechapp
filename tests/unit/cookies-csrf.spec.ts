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
});
