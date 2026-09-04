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

  const menuRepo = new MenuRepository(ctx.db);
  const isPlatformAdmin = ctx.user?.role === 'PLATFORM_ADMIN';

  // Get user's effective permissions + feature flags directly
  const userPerms = ctx.user?.permissions ?? [];

  // PLATFORM_ADMIN: no single-gym context, so return the full unfiltered menu
  // so the admin can navigate and manage any gym's data.
  if (!ctx.gymId) {
    if (isPlatformAdmin) {
      const fullMenu = await menuRepo.getFullMenu();
      return jsonOk({ menu: fullMenu });
    }
    return jsonErr('Gym context required', 403);
  }

  const enabledFeatures = await getGymFeatures(ctx.env.DB as any, ctx.gymId);

  // Fetch full menu tree
  const fullMenu = await menuRepo.getFullMenu();

  // Filter tree by permissions + features
  const filtered = menuRepo.filterMenu(fullMenu, userPerms, enabledFeatures, isPlatformAdmin);

  return jsonOk({ menu: filtered });
});
