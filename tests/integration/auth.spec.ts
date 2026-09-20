import { describe, it, expect } from 'vitest';
import {
  ApiClient,
  SEED,
  getTestEnv,
  loginAsOwner,
  loginAsPlatformAdmin,
  resetRateLimit,
  setupHarnessTeardown,
} from './harness';

// Dispose the wrangler platform proxy after the run — a leaked proxy keeps its
// workerd child alive and locks the shared D1 state directory.
setupHarnessTeardown();

/**
 * Regression guard for the bootstrap path: the credentials in
 * `apps/api/seed/seed_production.sql` must actually authenticate.
 *
 * A previous seed hard-coded password hashes that had drifted from
 * `lib/password.ts`, so every login on a fresh database failed. These tests
 * fail loudly if that ever happens again.
 */
describe('auth — seeded credentials', () => {
  it('signs in the seeded gym owner', async () => {
    const env = await getTestEnv();
    const client = new ApiClient(env);

    const res = await client.post<{ user: { email: string; isOwner?: boolean } }>(
      '/api/auth/login',
      SEED.owner
    );

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(SEED.owner.email);
    expect(client.cookieHeader).toContain('gym_token');
    expect(client.csrfToken).toBeTruthy();
  });

  it('signs in the seeded platform super admin', async () => {
    const { client } = await loginAsPlatformAdmin();
    const res = await client.get<{ user: { email: string } }>('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(SEED.platformAdmin.email);
  });

  it('emits session and CSRF cookies as separate Set-Cookie headers', async () => {
    const env = await getTestEnv();
    const client = new ApiClient(env);
    const res = await client.post('/api/auth/login', SEED.owner);
    expect(res.status).toBe(200);

    const raw: string[] =
      typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
        ? (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
        : [res.headers.get('set-cookie') ?? ''];

    // Folding both cookies into one header (join(', ')) makes browsers keep only
    // the first one, which silently breaks the CSRF double-submit cookie.
    expect(raw).toHaveLength(2);
    const names = raw.map((c) => c.split('=')[0]?.trim());
    expect(names).toContain('gym_token');
    expect(names).toContain('gym_csrf');
    expect(raw.some((c) => c.includes('gym_token') && c.includes('gym_csrf'))).toBe(false);
  });

  it('returns the authenticated owner from /api/auth/me', async () => {
    const { client } = await loginAsOwner();
    const res = await client.get<{ user: { email: string } }>('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(SEED.owner.email);
  });

  it('never leaks a password hash in the login response', async () => {
    const env = await getTestEnv();
    const client = new ApiClient(env);
    const res = await client.post('/api/auth/login', SEED.owner);

    expect(JSON.stringify(res.body)).not.toContain('pbkdf2');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('rejects a wrong password', async () => {
    const env = await getTestEnv();
    const client = new ApiClient(env);
    const res = await client.post('/api/auth/login', {
      email: SEED.owner.email,
      password: 'definitely-not-the-password',
    });

    expect(res.status).toBe(401);
  });

  it('rejects an unknown email with the same generic error', async () => {
    const env = await getTestEnv();
    const client = new ApiClient(env);
    const res = await client.post<{ error: string }>('/api/auth/login', {
      email: 'nobody@gymtech.app',
      password: SEED.owner.password,
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('bootstraps a CSRF token via GET /api/auth/csrf', async () => {
    const env = await getTestEnv();
    const client = new ApiClient(env);
    const res = await client.get('/api/auth/csrf');

    expect(res.status).toBe(200);
    expect(res.headers.get('X-CSRF-Token')).toBeTruthy();
    expect(client.csrfToken).toBeTruthy();
  });

  it('logs out and invalidates the session', async () => {
    // Uses its own login (not the shared cached session) because logout
    // revokes the token server-side.
    const env = await getTestEnv();
    const client = new ApiClient(env);
    const login = await client.post('/api/auth/login', SEED.owner);
    expect(login.status).toBe(200);

    const logout = await client.post('/api/auth/logout');
    expect(logout.status).toBe(200);

    const after = await client.get('/api/auth/me');
    expect(after.status).toBe(401);
  });
});

describe('auth — CSRF enforcement', () => {
  it('rejects a state-changing request with no CSRF header', async () => {
    const { client } = await loginAsOwner();
    const res = await client.request('POST', '/api/members', {
      body: { firstName: 'Csrf', lastName: 'Probe', phone: '9000000001' },
      withCsrf: false,
    });

    expect(res.status).toBe(403);
    expect((res.body as { code?: string }).code).toBe('CSRF_MISSING');
  });

  it('rejects a forged CSRF token that does not match the cookie', async () => {
    const { client } = await loginAsOwner();
    client.setCookie('gym_csrf', 'forged-cookie-value');
    // Send a header deliberately different from the cookie — a matching pair
    // would (correctly) pass the double-submit check.
    const res = await client.request('POST', '/api/members', {
      body: { firstName: 'Csrf', lastName: 'Probe', phone: '9000000002' },
      withCsrf: false,
      headers: { 'X-CSRF-Token': 'forged-header-value' },
    });

    expect(res.status).toBe(403);
    expect((res.body as { code?: string }).code).toBe('CSRF_MISMATCH');
  });

  it('rejects a token that is absent from the cookie jar', async () => {
    const { client } = await loginAsOwner();
    const token = client.csrfToken;
    client.clearCookies();
    const res = await client.request('POST', '/api/members', {
      body: { firstName: 'Csrf', lastName: 'Probe', phone: '9000000003' },
      withCsrf: false,
      headers: { 'X-CSRF-Token': token ?? '' },
    });

    // No session cookie either, so auth rejects it — but never a 2xx.
    expect([401, 403]).toContain(res.status);
  });

  it('rejects unauthenticated access to protected routes', async () => {
    const env = await getTestEnv();
    const anon = new ApiClient(env);
    const csrf = await anon.get('/api/auth/csrf');
    expect(csrf.status).toBe(200);

    const res = await anon.get('/api/members');
    expect(res.status).toBe(401);
  });
});

/**
 * Rate-limit tiers must be independent buckets.
 *
 * Previously every tier shared one `rl:<ip>` key, so ordinary read traffic
 * consumed the 5-per-minute auth budget: after five requests of any kind from
 * an IP, signing in returned 429 for the rest of the window.
 */
describe('auth — rate limit tiers are independent', () => {
  it('does not consume the login budget with ordinary read traffic', async () => {
    const env = await getTestEnv();
    const ip = '203.0.113.7';
    await resetRateLimit(env, 'read', ip);
    await resetRateLimit(env, 'auth', ip);
    const client = new ApiClient(env, ip);

    for (let i = 0; i < 12; i++) {
      const read = await client.get('/api/auth/csrf');
      expect(read.status).toBe(200);
    }

    const login = await client.post('/api/auth/login', SEED.platformAdmin);
    expect(login.status).toBe(200);
  });

  it('still blocks a burst of repeated login attempts', async () => {
    const env = await getTestEnv();
    const ip = '203.0.113.8';
    await resetRateLimit(env, 'auth', ip);
    const client = new ApiClient(env, ip);

    // Unknown email so the progressive account lockout is not triggered —
    // this test is about the limiter, not the lockout.
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await client.post('/api/auth/login', {
        email: `nobody-${i}@example.com`,
        password: 'wrong-password',
      });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(statuses[10]).toBe(429);
  });

  it('reports rate-limit headers', async () => {
    const env = await getTestEnv();
    const ip = '203.0.113.9';
    await resetRateLimit(env, 'read', ip);
    const client = new ApiClient(env, ip);
    const res = await client.get('/api/auth/csrf');

    expect(res.headers.get('X-RateLimit-Limit')).toBe('600');
    expect(res.headers.get('X-RateLimit-Remaining')).toBeTruthy();
  });
});
