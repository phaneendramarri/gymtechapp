// filepath: apps/api/src/routes/audit.routes.ts
import { Hono } from 'hono';
import { requireGym, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler } from '../middleware/params';
import { AuditService } from '../services/audit.service';
import { jsonOk, jsonValidationErr, parsePageParams, jsonPaginated } from './helpers';

export const auditRoutes = new Hono();

auditRoutes.get('/', requireGym, requirePermission('audit_logs'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const { limit, offset } = parsePageParams(c.req.query('limit'), c.req.query('offset'), 'audit');
  const action = c.req.query('action') || undefined;
  const entityType = c.req.query('entityType') || undefined;
  const auditService = new AuditService(ctx.env.DB);
  const result = await auditService.listGymEvents(ctx.gymId!, { limit, offset, action, entityType });
  return jsonPaginated(result.events, result.total, limit, offset);
}));
