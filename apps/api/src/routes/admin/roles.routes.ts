// filepath: apps/api/src/routes/admin/roles.routes.ts
/**
 * Platform Admin: manage ALL gym roles across the platform.
 * Gym owners/staff use /api/roles (read-only) — only Platform Admin can mutate.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { CreateRoleRequestSchema, UpdateRoleRequestSchema } from '@gymtech/shared';
import { requireSuperAdminMiddleware } from '../../middleware/auth';
import { getCtx } from '../../middleware/context';
import { safeHandler, paramId } from '../../middleware/params';
import { RoleRepository } from '../../repositories/role.repository';
import { jsonErr, jsonOk, jsonValidationErr } from '../helpers';

const CreatePlatformRoleSchema = CreateRoleRequestSchema.extend({
  gymId: z.number().int().positive('gymId is required'),
});

export const adminRoleRoutes = new Hono();

// GET /admin/roles — list all roles across all gyms (or filter by gymId)
adminRoleRoutes.get('/', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const gymId = c.req.query('gymId');
  const roleRepo = new RoleRepository(ctx.db);
  const roles = gymId
    ? await roleRepo.findByGymId(Number(gymId))
    : await roleRepo.listAll();
  return jsonOk({
    roles: roles.map((r) => ({ ...r, permissions: JSON.parse(r.permissions) })),
  });
}));

// POST /admin/roles — create a role for a specific gym
adminRoleRoutes.post('/', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreatePlatformRoleSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid role payload');

  const roleRepo = new RoleRepository(ctx.db);
  const existing = await roleRepo.findByName(parsed.data.gymId, parsed.data.name);
  if (existing) return jsonErr('A role with this name already exists for this gym', 409);

  const id = await roleRepo.create({
    gymId: parsed.data.gymId,
    name: parsed.data.name,
    permissions: parsed.data.permissions ?? [],
    isDefault: parsed.data.isDefault ?? false,
  });

  const created = await roleRepo.findById(id);
  return jsonOk({ ...created, permissions: JSON.parse(created!.permissions) }, 201);
}));

// PUT /admin/roles/:id — update a role
adminRoleRoutes.put('/:id', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateRoleRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid role payload');

  const roleRepo = new RoleRepository(ctx.db);
  const before = await roleRepo.findById(id);
  if (!before) return jsonErr('Role not found', 404);

  if (parsed.data.name && parsed.data.name !== before.name) {
    const duplicate = await roleRepo.findByName(before.gymId, parsed.data.name);
    if (duplicate) return jsonErr('A role with this name already exists for this gym', 409);
  }

  await roleRepo.update(id, {
    name: parsed.data.name,
    permissions: parsed.data.permissions,
    isDefault: parsed.data.isDefault,
  });

  const updated = await roleRepo.findById(id);
  return jsonOk({ ...updated, permissions: JSON.parse(updated!.permissions) });
}));

// DELETE /admin/roles/:id — soft-delete a role
adminRoleRoutes.delete('/:id', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const roleRepo = new RoleRepository(ctx.db);
  const role = await roleRepo.findById(id);
  if (!role) return jsonErr('Role not found', 404);

  await roleRepo.softDelete(id);
  return jsonOk({ success: true });
}));

// POST /admin/roles/:id/restore — restore a soft-deleted role
adminRoleRoutes.post('/:id/restore', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const roleRepo = new RoleRepository(ctx.db);
  await roleRepo.restore(id);
  const restored = await roleRepo.findById(id);
  return jsonOk({ ...restored, permissions: JSON.parse(restored!.permissions) });
}));
