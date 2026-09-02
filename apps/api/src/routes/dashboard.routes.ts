// filepath: apps/api/src/routes/dashboard.routes.ts
import { Hono } from 'hono';
import { requireGym, requireFeature } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { DashboardService } from '../services/dashboard.service';
import { jsonOk } from './helpers';
import { safeHandler } from '../middleware/params';

export const dashboardRoutes = new Hono();

dashboardRoutes.get('/', requireGym, requireFeature('dashboard'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const tenant = c.get('tenant' as never) as { gym: { name: string } };
  const dashboardService = new DashboardService(ctx.env.DB, ctx.gymId!, tenant.gym.name);
  return jsonOk(await dashboardService.getMetrics(ctx.user?.role));
}));