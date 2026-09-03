// filepath: apps/api/src/routes/roles.routes.ts
import { Hono } from 'hono';
import { CreateRoleRequestSchema, UpdateRoleRequestSchema } from '@gymtech/shared';
import { requireGym, requireFeature, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler, paramId } from '../middleware/params';
import { RoleRepository } from '../repositories/role.repository';
import { auditGymFromCtx } from '../services/audit.service';
import { jsonErr, jsonOk, jsonValidationErr } from './helpers';

export const roleRoutes = new Hono();

const auditGym = auditGymFromCtx;

// GET /roles — list all roles for the gym
roleRoutes.get('/', requireGym, requirePermission('staff'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const roleRepo = new RoleRepository(ctx.db);
  const gymRoles = await roleRepo.findByGymId(ctx.gymId!);
  // Parse permissions JSON for each role before returning
  const rolesWithPerms = gymRoles.map((r) => ({
    ...r,
    permissions: JSON.parse(r.permissions) as string[],
  }));
  return jsonOk({ roles: rolesWithPerms });
}));

// POST /roles — create a new role
roleRoutes.post('/', requireGym, requirePermission('staff'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateRoleRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid role payload');

  const roleRepo = new RoleRepository(ctx.db);
  const existing = await roleRepo.findByName(ctx.gymId!, parsed.data.name);
  if (existing) return jsonErr('A role with this name already exists', 409);

  const id = await roleRepo.create({
    gymId: ctx.gymId!,
    name: parsed.data.name,
    permissions: parsed.data.permissions ?? [],
    isDefault: parsed.data.isDefault ?? false,
  });

  await auditGym(ctx, 'role.create', 'role', id, { after: { name: parsed.data.name, permissions: parsed.data.permissions } });
  const created = await roleRepo.findById(id);
  return jsonOk({
    ...created,
    permissions: JSON.parse(created!.permissions) as string[],
  }, 201);
}));

// PUT /roles/:id — update a role
roleRoutes.put('/:id', requireGym, requirePermission('staff'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateRoleRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid role update');

  const roleRepo = new RoleRepository(ctx.db);
  const before = await roleRepo.findById(id);
  if (!before || before.gymId !== ctx.gymId!) return jsonErr('Role not found', 404);

  // Prevent renaming to an existing role name in this gym
  if (parsed.data.name && parsed.data.name !== before.name) {
    const duplicate = await roleRepo.findByName(ctx.gymId!, parsed.data.name);
    if (duplicate) return jsonErr('A role with this name already exists', 409);
  }

  await roleRepo.update(id, {
    name: parsed.data.name,
    permissions: parsed.data.permissions,
    isDefault: parsed.data.isDefault,
  });

  await auditGym(ctx, 'role.update', 'role', id, { before, after: parsed.data });
  const updated = await roleRepo.findById(id);
  return jsonOk({
    ...updated,
    permissions: JSON.parse(updated!.permissions) as string[],
  });
}));

// DELETE /roles/:id — soft-delete a role
roleRoutes.delete('/:id', requireGym, requirePermission('staff'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const roleRepo = new RoleRepository(ctx.db);
  const role = await roleRepo.findById(id);
  if (!role || role.gymId !== ctx.gymId!) return jsonErr('Role not found', 404);

  await roleRepo.softDelete(id);
  await auditGym(ctx, 'role.delete', 'role', id, { before: { name: role.name } });
  return jsonOk({ success: true, message: 'Role deleted successfully.' });
}));
