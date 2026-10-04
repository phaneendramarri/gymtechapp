/**
 * Hono composition root — single source of truth for routing.
 */
import { Hono, type MiddlewareHandler, type Context } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';

import { contextMiddleware, type RequestContext } from './middleware/context';
import { csrfMiddleware } from './middleware/csrf';
import { rateLimitMiddleware, createRateLimitMiddleware, type RateLimitTier } from './middleware/ratelimit';
import { kvRateLimiterStore, createRateLimiter } from './lib/ratelimit';
import type { TenantResolution } from './middleware/auth';

import { authRoutes } from './routes/auth.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { memberRoutes } from './routes/members.routes';
import { attendanceRoutes } from './routes/attendance.routes';
import { paymentRoutes } from './routes/payments.routes';
import { planRoutes } from './routes/plans.routes';
import { staffRoutes } from './routes/staff.routes';
import { roleRoutes } from './routes/roles.routes';
import { menuRoutes } from './routes/menu.routes';
import { settingsRoutes } from './routes/settings.routes';
import { ptRoutes } from './routes/pt.routes';
import { reportRoutes } from './routes/reports.routes';
import { mediaRoutes } from './routes/media.routes';
import { adminRoutes } from './routes/admin.routes';
import { adminRoleRoutes } from './routes/admin/roles.routes';
import { adminUserRoutes } from './routes/admin/users.routes';
import { auditRoutes } from './routes/audit.routes';
import { classesRoutes } from './routes/classes.routes';
import { posRoutes } from './routes/pos.routes';
import { expensesRoutes } from './routes/expenses.routes';
import { lockersRoutes } from './routes/lockers.routes';

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
  // MSG91 — Email + SMS + WhatsApp through one account. Only AUTH_KEY is
  // secret (wrangler secret put); the rest can be env vars or platform
  // settings (Admin → Communications), which override env when set.
  MSG91_AUTH_KEY?: string;
  MSG91_SENDER_ID?: string;
  MSG91_EMAIL_FROM?: string;
  MSG91_WA_NUMBER?: string;
  MSG91_SMS_FLOW_ID?: string;
  MSG91_WHATSAPP_TEMPLATE?: string;
  MSG91_WHATSAPP_LANGUAGE?: string;
  EMAIL_FROM?: string;
  APP_URL?: string;
  // Filebase (S3-compatible) — see apps/api/src/lib/filebase.ts
  FILEBASE_ENDPOINT?: string;
  FILEBASE_REGION?: string;
  FILEBASE_BUCKET?: string;
  FILEBASE_ACCESS_KEY_ID?: string;
  FILEBASE_SECRET_ACCESS_KEY?: string;
  // Rate limiting — Workers KV namespace bound in wrangler.jsonc.
  // Falls back to in-memory store when absent (local dev / tests).
  RATELIMIT_KV?: KVNamespace;
  // JWT denylist — Workers KV namespace for revoked jti tokens.
  // When absent, revocation relies on DB check only (local dev / tests).
  DENYLIST_KV?: KVNamespace;
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
      const raw = c.env.CORS_ORIGINS;
      // SECURITY: never combine wildcard origin with `credentials: true`
      // — browsers reject it AND servers that accept it leak cookies to
      // any attacker-controlled origin. We ALWAYS require an explicit
      // allowlist. If not configured, return empty string to reject.
      if (!raw || raw === '*') {
        console.warn('[CORS] CORS_ORIGINS not configured or set to wildcard. Request rejected.');
        return '';
      }
      const list = raw.split(',').map((o: string) => o.trim()).filter(Boolean);
      // Echo the requested origin only if it matches the allowlist;
      // returning `''` makes the browser reject the response.
      return list.includes(origin) ? origin : '';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id', 'X-CSRF-Token'],
    exposeHeaders: ['X-Request-Id', 'X-CSRF-Token'],
    maxAge: 86400,
    credentials: true,
  })
);

// Security headers — apply to all responses
app.use('*', async (c, next) => {
  await next();
  // HSTS (only in production with HTTPS)
  if (c.env.APP_ENV === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // Prevent clickjacking
  c.header('X-Frame-Options', 'DENY');
  // Prevent MIME type sniffing
  c.header('X-Content-Type-Options', 'nosniff');
  // Referrer policy
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Basic CSP — adjust as needed for your inline styles/scripts
  c.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
});

app.use('*', contextMiddleware as unknown as MiddlewareHandler<{ Bindings: AppEnv; Variables: AppVars }>);
// Request body size limit — prevent DoS via large payloads (Cloudflare Workers limit: 128MB)
// Media uploads permit up to 10MB (see apps/api/src/lib/media.ts MAX_UPLOAD_BYTES); standard routes cap at 1MB.
app.use('/api/*', async (c, next) => {
  const path = c.req.path;
  const isMediaUpload = path.startsWith('/api/v1/media/upload') || path.startsWith('/api/media/upload');
  const maxBytes = isMediaUpload ? 10 * 1024 * 1024 : 1024 * 1024;
  const contentLength = c.req.header('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    return c.json({ error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' }, 413);
  }
  await next();
});
// CSRF protection — runs for every request, but only enforces on
// state-changing methods (POST/PUT/PATCH/DELETE). See middleware/csrf.ts.
app.use('/api/*', csrfMiddleware as unknown as MiddlewareHandler<{ Bindings: AppEnv; Variables: AppVars }>);
// Rate limiting — KV-backed sliding window; falls back to in-memory when
// RATELIMIT_KV is not bound (local dev only). Applied before auth so attackers
// can be blocked before consuming CPU on password hashing.
// In production, RATELIMIT_KV MUST be bound; otherwise the app will fail to start.
// Tier derivation: auth routes use tier 'auth' (10 req/min), other safe methods
// 'read' (600 req/min) and other writes 'write' (120 req/min). Each tier keeps a
// separate per-IP bucket.
app.use('/api/*', (c, next) => {
  const kv = c.env?.RATELIMIT_KV;
  const isProd = (c.env.APP_ENV ?? 'development') !== 'development';
  const store = kv ? kvRateLimiterStore(kv) : createRateLimiter(undefined, isProd);
  const getTier = (cc: Context<{ Bindings: AppEnv; Variables: AppVars }>): RateLimitTier => {
    const path = cc.req.path;
    const method = cc.req.method.toUpperCase();
    // Auth routes get the stricter 'auth' tier (10 req/min).
    // Both /api/v1/... (current) and /api/... (legacy redirect) supported.
    if (path.startsWith('/api/v1/auth/login') ||
        path.startsWith('/api/v1/auth/member-login') ||
        path.startsWith('/api/v1/auth/platform-login') ||
        path.startsWith('/api/v1/auth/forgot-password') ||
        path.startsWith('/api/v1/auth/reset-password') ||
        path.startsWith('/api/v1/auth/phone-login') ||
        path.startsWith('/api/auth/login') ||
        path.startsWith('/api/auth/member-login') ||
        path.startsWith('/api/auth/platform-login') ||
        path.startsWith('/api/auth/forgot-password') ||
        path.startsWith('/api/auth/reset-password') ||
        path.startsWith('/api/auth/phone-login')) {
      return 'auth';
    }
    // Check-in endpoints get a dedicated stricter tier (30 req/min).
    // Shared gym Wi-Fi = single public IP; this prevents a single user
    // or script from exhausting the write budget for all staff/members.
    if (path.startsWith('/api/v1/attendance/check-in') ||
        path.startsWith('/api/attendance/check-in')) {
      return 'checkin';
    }
    // Safe methods are reads; everything else is a write. Each tier keeps its
    // own bucket (see middleware/ratelimit.ts), so this is what the TIERS
    // table documents: auth 10/min, checkin 30/min, write 120/min, read 600/min.
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return 'read';
    return 'write';
  };
  const mw = createRateLimitMiddleware(store as any, getTier);
  return mw(c, next);
});

// API Versioning: all routes now under /api/v1/
// Legacy /api/* paths redirect to /api/v1/* for backward compatibility.
const v1 = new Hono<{ Bindings: AppEnv; Variables: AppVars }>();

v1.get('/health', (c) =>
  c.json({ status: 'ok', service: 'gym-saas-api', version: 'v1', runtime: 'cloudflare-pages-hono' })
);
v1.get('/', (c) =>
  c.json({ name: 'Gym SaaS API', version: 'v1', status: 'online', runtime: 'Cloudflare Pages + Hono' })
);

v1.route('/auth', authRoutes);
v1.route('/dashboard', dashboardRoutes);
v1.route('/members', memberRoutes);
v1.route('/attendance', attendanceRoutes);
v1.route('/payments', paymentRoutes);
v1.route('/plans', planRoutes);
v1.route('/staff', staffRoutes);
v1.route('/roles', roleRoutes);
v1.route('/menus', menuRoutes);
v1.route('/settings', settingsRoutes);
v1.route('/pt', ptRoutes);
v1.route('/reports', reportRoutes);
v1.route('/media', mediaRoutes);
v1.route('/admin', adminRoutes);
v1.route('/admin/roles', adminRoleRoutes);
v1.route('/admin/users', adminUserRoutes);
v1.route('/audit-logs', auditRoutes);
v1.route('/classes', classesRoutes);
v1.route('/pos', posRoutes);
v1.route('/expenses', expensesRoutes);
v1.route('/lockers', lockersRoutes);

app.route('/api/v1', v1);

// Legacy redirects: /api/* → /api/v1/* (using 308 Permanent Redirect to preserve HTTP method & body)
app.all('/api/*', async (c, next) => {
  const legacyPath = c.req.path.replace(/^\/api/, '/api/v1');
  const url = new URL(c.req.url);
  url.pathname = legacyPath;
  return c.redirect(url.toString(), 308);
});

app.get('/api/health', (c) => c.redirect('/api/v1/health', 308));
app.get('/api', (c) => c.redirect('/api/v1', 308));

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