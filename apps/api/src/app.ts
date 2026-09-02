/**
 * Hono composition root — single source of truth for routing.
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';

import { contextMiddleware, type RequestContext } from './middleware/context';
import type { TenantResolution } from './middleware/auth';

import { authRoutes } from './routes/auth.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { memberRoutes } from './routes/members.routes';
import { attendanceRoutes } from './routes/attendance.routes';
import { paymentRoutes } from './routes/payments.routes';
import { planRoutes } from './routes/plans.routes';
import { staffRoutes } from './routes/staff.routes';
import { settingsRoutes } from './routes/settings.routes';
import { ptRoutes } from './routes/pt.routes';
import { reportRoutes } from './routes/reports.routes';
import { mediaRoutes } from './routes/media.routes';
import { adminRoutes } from './routes/admin.routes';
import { auditRoutes } from './routes/audit.routes';

export interface AppEnv {
  DB: D1Database;
  ASSETS?: Fetcher;
  JWT_SECRET: string;
  APP_ENV?: string;
  CORS_ORIGINS?: string;
  MEDIA_BUCKET?: R2Bucket;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_URL?: string;
  TURNSTILE_SECRET_KEY?: string;
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
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 86400,
    credentials: true,
  })
);
app.use('*', contextMiddleware as unknown as MiddlewareHandler<{ Bindings: AppEnv; Variables: AppVars }>);

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
app.route('/api/settings', settingsRoutes);
app.route('/api/pt', ptRoutes);
app.route('/api/reports', reportRoutes);
app.route('/api/v1/media', mediaRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/audit-logs', auditRoutes);

app.notFound((c) => c.json({ error: 'Endpoint not found' }, 404));
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

export type AppType = typeof app;