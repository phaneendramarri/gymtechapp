// filepath: apps/api/src/routes/audit.routes.ts
import { Hono } from 'hono';
import { requireGym, requireRole } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler } from '../middleware/params';
import { AuditService } from '../services/audit.service';
import { jsonOk, jsonValidationErr } from './helpers';

export const auditRoutes = new Hono();

auditRoutes.get('/', requireGym, requireRole('OWNER'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const action = c.req.query('action') || undefined;
  const entityType = c.req.query('entityType') || undefined;
  const auditService = new AuditService(ctx.env.DB);
  return jsonOk(await auditService.listGymEvents(ctx.gymId!, { limit, offset, action, entityType }));
}));
