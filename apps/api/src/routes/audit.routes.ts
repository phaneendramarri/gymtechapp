// filepath: apps/api/src/routes/audit.routes.ts
import { Hono } from 'hono';
import { requireGym, requireFeature, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler } from '../middleware/params';
import { AuditService } from '../services/audit.service';
import { jsonOk, jsonValidationErr, parsePageParams } from './helpers';

export const auditRoutes = new Hono();

auditRoutes.get('/', requireGym, requireFeature('audit_logs'), requirePermission('audit_logs'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const { limit, offset } = parsePageParams(c.req.query('limit'), c.req.query('offset'), 'audit');
  const action = c.req.query('action') || undefined;
  const entityType = c.req.query('entityType') || undefined;
  const auditService = new AuditService(ctx.env.DB);
  const result = await auditService.listGymEvents(ctx.gymId!, { limit, offset, action, entityType });
  // The web client reads `events` (see api.getGymAuditLogs) — jsonPaginated's
  // generic {items} envelope would leave the audit page permanently empty.
  return jsonOk({ events: result.events, total: result.total, limit, offset });
}));
