// filepath: apps/api/src/routes/menu.routes.ts
import { Hono } from 'hono';
import { requireGym } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler } from '../middleware/params';
import { MenuRepository } from '../repositories/menu.repository';
import { jsonOk } from './helpers';

export const menuRoutes = new Hono();

/**
 * GET /api/menus
 * Returns all active system menu items from the database.
 */
menuRoutes.get('/', requireGym, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const menuRepo = new MenuRepository(ctx.env.DB);
  const items = await menuRepo.listMenuItems();
  return jsonOk({ items });
}));
