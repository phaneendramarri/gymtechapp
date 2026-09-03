/**
 * Hono composition root — single source of truth for routing.
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';

import { contextMiddleware, type RequestContext } from './middleware/context';
import { csrfMiddleware } from './middleware/csrf';
import { rateLimitMiddleware, createRateLimitMiddleware } from './middleware/ratelimit';
import { kvRateLimiterStore } from './lib/ratelimit';
import type { TenantResolution } from './middleware/auth';

import { authRoutes } from './routes/auth.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { memberRoutes } from './routes/members.routes';
import { attendanceRoutes } from './routes/attendance.routes';
import { paymentRoutes } from './routes/payments.routes';
import { planRoutes } from './routes/plans.routes';
import { staffRoutes } from './routes/staff.routes';
import { roleRoutes } from './routes/roles.routes';
import { settingsRoutes } from './routes/settings.routes';
import { ptRoutes } from './routes/pt.routes';
import { reportRoutes } from './routes/reports.routes';
import { mediaRoutes } from './routes/media.routes';
import { adminRoutes } from './routes/admin.routes';
import { auditRoutes } from './routes/audit.routes';
import { menuRoutes } from './routes/menu.routes';

import type { Database } from './db/client';

export interface AppEnv {
  DB: D1Database;
  /** Cached Drizzle client — lazily created by context middleware. */
  drizzle?: Database;
  ASSETS?: Fetcher;
  JWT_SECRET: string;
  APP_ENV?: string;
  CORS_ORIGINS?: string;
  /** @deprecated R2 binding — kept for backward compat, not used by current routes. */
  MEDIA_BUCKET?: R2Bucket;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_URL?: string;
  TURNSTILE_SECRET_KEY?: string;
  // Filebase (S3-compatible) — see apps/api/src/lib/filebase.ts
  FILEBASE_ENDPOINT?: string;
  FILEBASE_REGION?: string;
  FILEBASE_BUCKET?: string;
  FILEBASE_ACCESS_KEY_ID?: string;
  FILEBASE_SECRET_ACCESS_KEY?: string;
  // Rate limiting — Workers KV namespace bound in wrangler.jsonc.
  // Falls back to in-memory store when absent (local dev / tests).
  RATELIMIT_KV?: KVNamespace;
  // Phase 4.2: AES-GCM key for encrypting face embeddings at rest.
  // When absent, face embeddings are stored as plain base64 (legacy/bulk-import path).
  FACE_EMBEDDING_KEY?: string;
}

type AppVars = { requestId: string; ctx: RequestContext; tenant?: TenantResolution };

export const app = new Hono<{ Bindings: AppEnv; Variables: AppVars }>();

app.use('*', requestId());
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const allowed = c.env.CORS_ORIGINS;
      if (!allowed || allowed === '*') return '*';
      const list = allowed.split(',').map((o: string) => o.trim());
      return list.includes(origin) ? origin : list[0] || '*';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id', 'X-CSRF-Token'],
    exposeHeaders: ['X-Request-Id', 'X-CSRF-Token'],
    maxAge: 86400,
    credentials: true,
  })
);
app.use('*', contextMiddleware as unknown as MiddlewareHandler<{ Bindings: AppEnv; Variables: AppVars }>);
// CSRF protection — runs for every request, but only enforces on
// state-changing methods (POST/PUT/PATCH/DELETE). See middleware/csrf.ts.
app.use('/api/*', csrfMiddleware as unknown as MiddlewareHandler<{ Bindings: AppEnv; Variables: AppVars }>);
// Rate limiting — KV-backed sliding window; falls back to in-memory when
// RATELIMIT_KV is not bound. Applied before auth so attackers can be blocked
// before consuming CPU on password hashing.
app.use('/api/*', (c, next) => {
  const kv = c.env?.RATELIMIT_KV;
  const store = kv ? kvRateLimiterStore(kv) : undefined;
  // createRateLimitMiddleware accepts undefined and uses in-memory internally
  const mw = createRateLimitMiddleware(store as any);
  return mw(c, next);
});

app.get('/api/health', (c) =>
  c.json({ status: 'ok', service: 'gym-saas-api', runtime: 'cloudflare-pages-hono' })
);
app.get('/', (c) =>
  c.json({ name: 'Gym SaaS API', status: 'online', runtime: 'Cloudflare Pages + Hono' })
);

app.route('/api/auth', authRoutes);
app.route('/api/dashboard', dashboardRoutes);
app.route('/api/members', memberRoutes);
app.route('/api/attendance', attendanceRoutes);
app.route('/api/payments', paymentRoutes);
app.route('/api/plans', planRoutes);
app.route('/api/staff', staffRoutes);
app.route('/api/roles', roleRoutes);
app.route('/api/settings', settingsRoutes);
app.route('/api/pt', ptRoutes);
app.route('/api/reports', reportRoutes);
app.route('/api/v1/media', mediaRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/audit-logs', auditRoutes);
app.route('/api/menu', menuRoutes);

// SPA catch-all — fetch and serve index.html from Workers Static Assets (ASSETS)
// so that BrowserRouter clean URLs (e.g. /login, /dashboard) work correctly.
// Workers Static Assets (configured via assets: in wrangler.jsonc) serves static
// files natively; this catches any path that didn't match an API route and returns
// the SPA shell with its full meta tags intact.
app.get('*', async (c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }
  if (c.env.ASSETS) {
    const indexHtml = await c.env.ASSETS.fetch(new Request(`${new URL(c.req.url).origin}/index.html`));
    if (indexHtml.ok) {
      const text = await indexHtml.text();
      return c.html(text);
    }
  }
  // Final fallback — minimal shell (should rarely hit this in production).
  return c.html('<!doctype html><html lang="en"><head><meta charset="UTF-8"/><title>GymTech</title></head><body><div id="root"></div></body></html>');
});

app.notFound((c) => c.json({ error: 'Endpoint not found' }, 404));
app.onError((err, c) => {
  // Log full stack server-side for ops.
  console.error('Unhandled error:', err);

  // Map known error shapes to clean status codes; hide internals.
  // - ZodError → 400 with the validation issues
  // - HttpError → status from the throw
  // - anything else → 500 with a generic message
  const requestId = c.get('requestId' as never) as string | undefined;
  const isZod = (err as any)?.name === 'ZodError' && Array.isArray((err as any).issues);
  if (isZod) {
    return c.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        issues: (err as any).issues,
        requestId,
      },
      400
    );
  }
  if (err && (err as any).name === 'HttpError') {
    const he = err as any;
    return c.json(
      {
        error: he.message,
        code: he.code,
        ...(he.details ? { details: he.details } : {}),
        requestId,
      },
      typeof he.status === 'number' ? he.status : 500
    );
  }
  // Unknown — log stack, return generic.
  return c.json(
    {
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      requestId,
    },
    500
  );
});

export type AppType = typeof app;