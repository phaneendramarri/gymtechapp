// filepath: apps/api/src/routes/roles.routes.ts
/**
 * Gym-level role routes.
 * Gym owners and managers can create, customize, and manage roles and menu permissions for their gym.
 */
import { Hono } from 'hono';
import { CreateRoleRequestSchema, UpdateRoleRequestSchema } from '@gymtech/shared';
import { requireGym, requireFeature, requirePermission } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler, paramId } from '../middleware/params';
import { RoleRepository } from '../repositories/role.repository';
import { MenuRepository } from '../repositories/menu.repository';
import { UserRepository } from '../repositories/user.repository';
import { auditGymFromCtx } from '../services/audit.service';
import { jsonErr, jsonOk, jsonValidationErr } from './helpers';

export const roleRoutes = new Hono();

// GET /api/roles — list all roles for this gym
roleRoutes.get('/', requireGym, requireFeature('staff'), requirePermission('staff'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const roleRepo = new RoleRepository(ctx.db);
  const menuRepo = new MenuRepository(ctx.env.DB);
  const gymRoles = await roleRepo.findByGymId(ctx.gymId!);

  const populated = await Promise.all(
    gymRoles.map(async (r) => {
      const menuItemIds = await menuRepo.getRoleMenuIds(ctx.gymId!, r.id);
      const dbKeys = await menuRepo.getRoleMenuKeys(ctx.gymId!, r.id);
      const permissions = dbKeys.length > 0 ? dbKeys : JSON.parse(r.permissions || '[]');
      return {
        ...r,
        permissions,
        menuItemIds,
      };
    })
  );

  return jsonOk({ roles: populated });
}));

// POST /api/roles — create a custom role with menu permissions for this gym
roleRoutes.post('/', requireGym, requireFeature('staff'), requirePermission('staff'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateRoleRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid role data');

  const roleRepo = new RoleRepository(ctx.db);
  const menuRepo = new MenuRepository(ctx.env.DB);
  const existing = await roleRepo.findByName(ctx.gymId!, parsed.data.name);
  if (existing) return jsonErr('A role with this name already exists in your gym', 409);

  let menuItemIds = parsed.data.menuItemIds ?? [];
  let permissions = parsed.data.permissions ?? [];

  // If menuItemIds provided, derive keys from menuItems
  if (menuItemIds.length > 0) {
    const allMenus = await menuRepo.listMenuItems();
    const idSet = new Set(menuItemIds);
    permissions = allMenus.filter((m) => idSet.has(m.id)).map((m) => m.key);
  } else if (permissions.length > 0) {
    // If only string permissions passed, derive menuItemIds from menuItems
    const allMenus = await menuRepo.listMenuItems();
    const permSet = new Set(permissions);
    menuItemIds = allMenus.filter((m) => permSet.has(m.key)).map((m) => m.id);
  }

  const id = await roleRepo.create({
    gymId: ctx.gymId!,
    name: parsed.data.name,
    permissions,
    isDefault: parsed.data.isDefault ?? false,
    createdBy: ctx.user!.id,
  });

  if (menuItemIds.length > 0) {
    await menuRepo.syncRoleMenus(ctx.gymId!, id, menuItemIds);
  }

  const created = await roleRepo.findById(id);
  await auditGymFromCtx(c, 'role.create', 'role', id, { after: { name: parsed.data.name, menuItemIds, permissions } });

  return jsonOk({ ...created, permissions, menuItemIds }, 201);
}));

// PUT /api/roles/:id — update a custom role and its menu permissions
roleRoutes.put('/:id', requireGym, requireFeature('staff'), requirePermission('staff'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateRoleRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationErr(parsed, 'Invalid role payload');

  const roleRepo = new RoleRepository(ctx.db);
  const menuRepo = new MenuRepository(ctx.env.DB);
  const before = await roleRepo.findById(id);
  if (!before || before.gymId !== ctx.gymId!) return jsonErr('Role not found in your gym', 404);

  // Prevent modifying the primary owner role
  if (before.isOwner) {
    return jsonErr('The primary Gym Owner role cannot be modified', 403);
  }

  if (parsed.data.name && parsed.data.name !== before.name) {
    const duplicate = await roleRepo.findByName(ctx.gymId!, parsed.data.name);
    if (duplicate && duplicate.id !== id) {
      return jsonErr('A role with this name already exists in your gym', 409);
    }
  }

  let menuItemIds = parsed.data.menuItemIds;
  let permissions = parsed.data.permissions;

  if (menuItemIds !== undefined) {
    await menuRepo.syncRoleMenus(ctx.gymId!, id, menuItemIds);
    const allMenus = await menuRepo.listMenuItems();
    const idSet = new Set(menuItemIds);
    permissions = allMenus.filter((m) => idSet.has(m.id)).map((m) => m.key);
  } else if (permissions !== undefined) {
    const allMenus = await menuRepo.listMenuItems();
    const permSet = new Set(permissions);
    menuItemIds = allMenus.filter((m) => permSet.has(m.key)).map((m) => m.id);
    await menuRepo.syncRoleMenus(ctx.gymId!, id, menuItemIds);
  }

  await roleRepo.update(id, {
    name: parsed.data.name,
    permissions,
    isDefault: parsed.data.isDefault,
  });

  const updated = await roleRepo.findById(id);
  const finalMenuIds = await menuRepo.getRoleMenuIds(ctx.gymId!, id);
  const finalKeys = await menuRepo.getRoleMenuKeys(ctx.gymId!, id);
  const finalPerms = finalKeys.length > 0 ? finalKeys : JSON.parse(updated!.permissions || '[]');

  await auditGymFromCtx(c, 'role.update', 'role', id, {
    before: { name: before.name, permissions: JSON.parse(before.permissions) },
    after: { name: updated!.name, menuItemIds: finalMenuIds, permissions: finalPerms },
  });

  return jsonOk({ ...updated, permissions: finalPerms, menuItemIds: finalMenuIds });
}));

// DELETE /api/roles/:id — soft-delete a role from this gym
roleRoutes.delete('/:id', requireGym, requireFeature('staff'), requirePermission('staff'), safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const roleRepo = new RoleRepository(ctx.db);
  const role = await roleRepo.findById(id);
  if (!role || role.gymId !== ctx.gymId!) return jsonErr('Role not found in your gym', 404);

  if (role.isOwner) {
    return jsonErr('The primary Gym Owner role cannot be deleted', 403);
  }

  // Detach users and menu links via the table owners.
  const userRepository = new UserRepository(ctx.env.DB);
  const menuRepository = new MenuRepository(ctx.env.DB);
  await userRepository.clearRoleAssignment(ctx.gymId!, id);
  await menuRepository.clearRoleMenus(ctx.gymId!, id);

  await roleRepo.softDelete(id);
  await auditGymFromCtx(c, 'role.delete', 'role', id, { before: { name: role.name } });

  return jsonOk({ success: true, message: 'Role deleted successfully.' });
}));

