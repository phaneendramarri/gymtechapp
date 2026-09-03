import { Hono } from 'hono';
import { requireAuth, getGymFeatures } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { MenuRepository } from '../repositories/menu.repository';
import { jsonOk, jsonErr } from './helpers';
import type { MenuNode } from '@gymtech/shared';

export const menuRoutes = new Hono();

/**
 * GET /api/menu
 * Returns the full filtered menu tree for the current user.
 * Requires auth (gym context is resolved from the session).
 */
menuRoutes.get('/', requireAuth, async (c) => {
  const ctx = getCtx(c);

  if (!ctx.gymId) {
    if (ctx.user?.role === 'PLATFORM_ADMIN') {
      return jsonOk({ menu: [] });
    }
    return jsonErr('Gym context required', 403);
  }

  const menuRepo = new MenuRepository(ctx.db);

  // Fetch full menu tree
  const fullMenu = await menuRepo.getFullMenu();

  // Get user's effective permissions + feature flags directly
  const userPerms = ctx.user?.permissions ?? [];
  const enabledFeatures = await getGymFeatures(ctx.env.DB as any, ctx.gymId);
  const isPlatformAdmin = ctx.user?.role === 'PLATFORM_ADMIN';

  // Filter tree by permissions + features
  const filtered = menuRepo.filterMenu(fullMenu, userPerms, enabledFeatures, isPlatformAdmin);

  return jsonOk({ menu: filtered });
});
