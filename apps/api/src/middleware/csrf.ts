// filepath: apps/api/src/middleware/csrf.ts
/**
 * CSRF protection via the double-submit-cookie pattern (Phase 1.2).
 *
 * The session is now an httpOnly cookie. The browser auto-attaches it to
 * any same-origin request, which is what makes cookie auth convenient —
 * but it also means a malicious site can trick the browser into sending
 * the cookie on a forged request (classic CSRF). The defense is to
 * require an extra, non-automatically-attached credential that the
 * attacker can't read.
 *
 * The web app sets a non-httpOnly `gym_csrf` cookie on login. On every
 * non-GET / non-HEAD / non-OPTIONS request, the web app must echo the
 * cookie value as the `X-CSRF-Token` header. The attacker can't read the
 * cookie from a different origin, so they can't forge the header.
 *
 * Verification uses a constant-time string comparison.
 */
import type { MiddlewareHandler, Context } from 'hono';
import { readCookie, COOKIE_NAMES } from '../lib/cookies';
import type { AppEnv } from '../app';

type Vars = Record<string, unknown>;
type Ctx = Context<{ Bindings: AppEnv; Variables: Vars }>;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Paths that don't need CSRF (login, forgot-password, reset-password).
// These are the only entry points that establish a session — they
// can't have a CSRF cookie yet, so requiring the token would brick
// first-time users.
const CSRF_EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/platform-login',
  '/api/auth/member-login',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/health',
  '/',
];

/**
 * Constant-time string comparison to prevent timing attacks on the CSRF
 * token check.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const csrfMiddleware: MiddlewareHandler<{ Bindings: AppEnv; Variables: Vars }> = async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return next();

  // Skip CSRF for non-cookie endpoints entirely.
  const path = c.req.path;
  if (CSRF_EXEMPT_PATHS.some((p) => path === p || path.startsWith(p + '/'))) {
    return next();
  }

  // For all other state-changing requests, require a matching
  // X-CSRF-Token header that matches the gym_csrf cookie.
  const cookieValue = readCookie(c.req.header('Cookie'), COOKIE_NAMES.CSRF);
  const headerValue = c.req.header('X-CSRF-Token');

  if (!cookieValue || !headerValue) {
    return c.json(
      { error: 'CSRF token missing', code: 'CSRF_MISSING' },
      403
    );
  }
  if (!constantTimeEqual(cookieValue, headerValue)) {
    return c.json(
      { error: 'CSRF token mismatch', code: 'CSRF_MISMATCH' },
      403
    );
  }

  return next();
};
