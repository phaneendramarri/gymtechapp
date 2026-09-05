import { Hono } from 'hono';
import { requireGym, requirePermission } from '../middleware/auth';
import { safeHandler } from '../middleware/params';
import { CommunicationRepository } from '../repositories/communication.repository';
import { jsonOk, jsonPaginated, parsePageParams } from './helpers';

export const communicationsRoutes = new Hono();

// ----- List communication logs -----
// Note: requirePermission('communications') gates this endpoint. If the
// role does not grant 'communications' permission the request is rejected.
communicationsRoutes.get('/', requireGym, requirePermission('communications'), safeHandler(async (c) => {
  const ctx = c.get('ctx');
  const channel = c.req.query('channel') as 'SMS' | 'WHATSAPP' | 'EMAIL' | undefined;
  const { limit, offset } = parsePageParams(c.req.query('limit'), c.req.query('offset'), 'communications');

  const repo = new CommunicationRepository(ctx.env.DB, ctx.gymId!);
  const result = await repo.list({ channel, limit, offset });

  return jsonPaginated(result.logs, result.total, limit, offset);
}));
