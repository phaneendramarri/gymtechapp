// filepath: apps/api/src/routes/menu.routes.ts
import { Hono } from 'hono';
import { requireGym, getGymFeatures } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { MenuRepository } from '../repositories/menu.repository';
import { jsonOk, jsonErr } from './helpers';
import type { MenuNode } from '@gymtech/shared';

export const menuRoutes = new Hono();

/**
 * GET /api/menu
 * Returns the full filtered menu tree for the current user.
 *
 * Uses requireGym so that:
 *   - role.permissions are merged with user-specific permission overrides
 *   - userPermissions (per-user grants) are correctly applied
 *   - feature flags are resolved for the gym
 *
 * Menu tree is cached for 60s to avoid hitting D1 on every request.
 */
menuRoutes.get('/', requireGym, async (c) => {
  const ctx = getCtx(c);

  const menuRepo = new MenuRepository(ctx.db);

  // PLATFORM_ADMIN: always return full unfiltered menu — they have permissions: ['*']
  // and filterMenu is a redundant no-op for them. getFullMenu() already filters to active items.
  if (ctx.user?.role === 'PLATFORM_ADMIN') {
    const fullMenu = await menuRepo.getFullMenu(ctx.gymId!);
    c.header('Cache-Control', 'private, max-age=60');
    return jsonOk({ menu: fullMenu });
  }

  // Regular users / gym staff
  if (!ctx.gymId) {
    return jsonErr('Gym context required', 403);
  }

  const userPerms = ctx.user?.permissions ?? [];
  const tenant = c.get('tenant');
  const enabledFeatures = tenant?.enabledFeatures ?? [];

  const fullMenu = await menuRepo.getFullMenu(ctx.gymId);

  // ctx.user.permissions already includes merged role + user-specific overrides
  // (requireGym loads role.permissions in auth.ts)
  const filtered = menuRepo.filterMenu(fullMenu, userPerms, enabledFeatures, false);

  c.header('Cache-Control', 'private, max-age=30');
  return jsonOk({ menu: filtered });
});
