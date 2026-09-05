// filepath: apps/api/src/routes/admin/menus.routes.ts
/**
 * Platform Admin: manage menu groups and menu items (sidebar navigation).
 * Changes here immediately affect what all gym users see in their sidebar.
 */
import { Hono } from 'hono';
import { requireSuperAdminMiddleware } from '../../middleware/auth';
import { getCtx } from '../../middleware/context';
import { safeHandler, paramId } from '../../middleware/params';
import { MenuRepository } from '../../repositories/menu.repository';
import { jsonErr, jsonOk } from '../helpers';

export const adminMenuRoutes = new Hono();

// ----- Menu Groups -----

// GET /admin/menus/groups — list all menu groups
adminMenuRoutes.get('/groups', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const menuRepo = new MenuRepository(ctx.db);
  const groups = await menuRepo.listGroups();
  return jsonOk({ groups });
}));

// GET /admin/menus/groups/:id — get a single menu group
adminMenuRoutes.get('/groups/:id', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const menuRepo = new MenuRepository(ctx.db);
  const group = await menuRepo.getGroupById(id);
  if (!group) return jsonErr('Group not found', 404);
  return jsonOk(group);
}));

// POST /admin/menus/groups — create a menu group
adminMenuRoutes.post('/groups', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const { key, label, icon, order } = body;
  if (!key || !label) return jsonErr('key and label are required', 400);

  const menuRepo = new MenuRepository(ctx.db);
  const id = await menuRepo.createGroup({ key, label, icon: icon ?? 'Folder', order: order ?? 0 });
  menuRepo.invalidateCache();
  return jsonOk({ id }, 201);
}));

// PUT /admin/menus/groups/:id — update a menu group
adminMenuRoutes.put('/groups/:id', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const menuRepo = new MenuRepository(ctx.db);
  await menuRepo.updateGroup(id, body);
  menuRepo.invalidateCache();
  return jsonOk({ id, ...body });
}));

// DELETE /admin/menus/groups/:id — soft-delete a menu group
adminMenuRoutes.delete('/groups/:id', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const menuRepo = new MenuRepository(ctx.db);
  await menuRepo.deleteGroup(id);
  menuRepo.invalidateCache();
  return jsonOk({ success: true });
}));

// POST /admin/menus/groups/:id/restore — restore a soft-deleted menu group
adminMenuRoutes.post('/groups/:id/restore', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const menuRepo = new MenuRepository(ctx.db);
  await menuRepo.restoreGroup(id);
  menuRepo.invalidateCache();
  return jsonOk({ success: true });
}));

// ----- Menu Items -----

// GET /admin/menus/items — list all menu items (optionally filter by group)
adminMenuRoutes.get('/items', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const groupKey = c.req.query('groupKey') ?? undefined;
  const menuRepo = new MenuRepository(ctx.db);
  const items = await menuRepo.listItems(groupKey);
  return jsonOk({
    items: items.map((item) => ({ ...item, permissions: JSON.parse(item.permissions) })),
  });
}));

// GET /admin/menus/items/:id — get a single menu item
adminMenuRoutes.get('/items/:id', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const menuRepo = new MenuRepository(ctx.db);
  const item = await menuRepo.getItemById(id);
  if (!item) return jsonErr('Item not found', 404);
  return jsonOk({ ...item, permissions: JSON.parse(item.permissions) });
}));

// POST /admin/menus/items — create a menu item
adminMenuRoutes.post('/items', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const { groupKey, key, label, href, icon, order, permissions, featureKey, adminOnly } = body;
  if (!groupKey || !key || !label) return jsonErr('groupKey, key and label are required', 400);

  const menuRepo = new MenuRepository(ctx.db);
  const id = await menuRepo.createItem({
    groupKey, key, label,
    href: href ?? null,
    icon: icon ?? null,
    order: order ?? 0,
    permissions: permissions ?? [],
    featureKey: featureKey ?? null,
    adminOnly: adminOnly ?? false,
  });
  menuRepo.invalidateCache();
  return jsonOk({ id }, 201);
}));

// PUT /admin/menus/items/:id — update a menu item
adminMenuRoutes.put('/items/:id', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const body = await c.req.json().catch(() => ({}));
  const menuRepo = new MenuRepository(ctx.db);
  await menuRepo.updateItem(id, {
    label: body.label,
    href: body.href,
    icon: body.icon,
    order: body.order,
    permissions: body.permissions,
    featureKey: body.featureKey,
    adminOnly: body.adminOnly,
    isActive: body.isActive,
  });
  menuRepo.invalidateCache();
  return jsonOk({ id, ...body });
}));

// DELETE /admin/menus/items/:id — soft-delete a menu item
adminMenuRoutes.delete('/items/:id', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const menuRepo = new MenuRepository(ctx.db);
  await menuRepo.deleteItem(id);
  menuRepo.invalidateCache();
  return jsonOk({ success: true });
}));

// POST /admin/menus/items/:id/restore — restore a soft-deleted menu item
adminMenuRoutes.post('/items/:id/restore', requireSuperAdminMiddleware, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const id = paramId(c.req.param() as Record<string, string>);
  const menuRepo = new MenuRepository(ctx.db);
  await menuRepo.restoreItem(id);
  menuRepo.invalidateCache();
  return jsonOk({ success: true });
}));
