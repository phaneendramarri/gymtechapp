// filepath: apps/api/src/routes/roles.routes.ts
/**
 * Gym-level role routes — READ ONLY.
 * Gym staff can list/view roles, but only Platform Admin can create/update/delete
 * via /api/admin/roles.
 */
import { Hono } from 'hono';
import { requireGym, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler } from '../middleware/params';
import { RoleRepository } from '../repositories/role.repository';
import { jsonOk } from './helpers';

export const roleRoutes = new Hono();

// GET /roles — list all roles for the gym (read-only)
roleRoutes.get('/', requireGym, requirePermission('staff'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const roleRepo = new RoleRepository(ctx.db);
  const gymRoles = await roleRepo.findByGymId(ctx.gymId!);
  return jsonOk({
    roles: gymRoles.map((r) => ({ ...r, permissions: JSON.parse(r.permissions) })),
  });
}));
