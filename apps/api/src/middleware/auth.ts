// filepath: apps/api/src/middleware/auth.ts
import type { MiddlewareHandler, Context } from 'hono';
import type { AppEnv } from '../app';
import { verifySessionToken, payloadToSessionUser } from '../lib/session';
import { readCookie, COOKIE_NAMES } from '../lib/cookies';
import { GYM_FEATURES } from '@gymtech/shared';
import type { Gym, License, GymFeatureKey, UserRole } from '@gymtech/shared';
import { getCtx, setUser, type RequestContext } from './context';
import { jsonError, checkRole } from '../lib/roles';

// Re-export for convenience — routes still import these from middleware/auth.
export { jsonError, checkRole };

export interface TenantResolution {
  gym: Gym;
  license: License;
  enabledFeatures: GymFeatureKey[];
}

type AuthVars = { ctx: RequestContext; tenant?: TenantResolution };
type AuthContext = Context<{ Bindings: AppEnv; Variables: AuthVars }>;

/**
 * Extract the JWT from the request: prefer the httpOnly `gym_token` cookie,
 * fall back to the `Authorization: Bearer …` header for clients that can't
 * use cookies (mobile apps, server-to-server calls).
 */
function extractJwt(c: Context<{ Bindings: AppEnv; Variables: AuthVars }>): string | null {
  const cookieToken = readCookie(c.req.header('Cookie'), COOKIE_NAMES.SESSION);
  if (cookieToken) return cookieToken;
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.substring(7);
  return null;
}

export const requireAuth: MiddlewareHandler<{ Bindings: AppEnv; Variables: AuthVars }> = async (c, next) => {
  const ctx = getCtx(c);
  if (ctx.user && ctx.gymId !== undefined) return next();

  const token = extractJwt(c);
  if (!token) {
    return jsonError('Missing or invalid session credential', 401);
  }

  const session = await verifySessionToken(token, c.env.JWT_SECRET);
  if (!session) return jsonError('Invalid or expired session token', 401);

  if (session.gymId !== null) {
    const dbUser = await c.env.DB
      .prepare(`SELECT status, deleted_at FROM users WHERE id = ? AND gym_id = ?`)
      .bind(session.id, session.gymId)
      .first<{ status: string; deleted_at: number | null }>();
    if (!dbUser || dbUser.deleted_at !== null) {
      return jsonError('User account has been archived or deleted', 401);
    }
    if (dbUser.status === 'DISABLED') {
      return jsonError('User account is currently disabled by administrator', 403);
    }
  }

  setUser(c, payloadToSessionUser(session), session.gymId ?? undefined);
  return next();
};

export const requireGym: MiddlewareHandler<{ Bindings: AppEnv; Variables: AuthVars }> = async (c, next) => {
  const ctx = getCtx(c);

  const token = extractJwt(c);
  if (!token) {
    return jsonError('Missing or invalid session credential', 401);
  }
  const session = await verifySessionToken(token, c.env.JWT_SECRET);
  if (!session) return jsonError('Invalid or expired session token', 401);
  setUser(c, payloadToSessionUser(session), session.gymId ?? undefined);

  if (!ctx.gymId) {
    return jsonError('User is not assigned to a gym tenant', 403);
  }

  const gym = await c.env.DB
    .prepare(`SELECT * FROM gyms WHERE id = ? AND deleted_at IS NULL`)
    .bind(ctx.gymId)
    .first<Gym>();
  if (!gym) {
    // Treat "gym doesn't exist for the user" the same as "gym is disabled":
    // a 403 GYM_INACTIVE. A 404 here would let a probe distinguish a real
    // tenant from a missing/deleted one.
    return jsonError('Gym tenant is not accessible. Contact the platform administrator.', 403);
  }
  if (gym.status !== 'ACTIVE') {
    return jsonError(`This gym tenant is currently ${gym.status}.`, 403);
  }

  const license = await c.env.DB
    .prepare(`SELECT * FROM licenses WHERE gym_id = ?`)
    .bind(ctx.gymId)
    .first<License>();
  if (!license) return jsonError('No license is configured for this gym', 403);
  if (license.status !== 'ACTIVE') {
    return jsonError(`Gym license is ${license.status}.`, 403);
  }
  if (license.expires_at < Math.floor(Date.now() / 1000)) {
    return jsonError('Gym license has expired.', 403);
  }

  const featureRows = await c.env.DB
    .prepare(`SELECT feature_key FROM gym_features WHERE gym_id = ? AND is_enabled = 1`)
    .bind(ctx.gymId)
    .all<{ feature_key: string }>();
  const enabledFeatures: GymFeatureKey[] =
    featureRows.results && featureRows.results.length > 0
      ? (featureRows.results.map((r) => r.feature_key as GymFeatureKey))
      : [...GYM_FEATURES];

  const tenant: TenantResolution = { gym: { ...gym, enabled_features: enabledFeatures }, license, enabledFeatures };
  c.set('tenant', tenant);
  return next();
};

export function requireRole(...allowed: UserRole[]) {
  return async (c: AuthContext, next: () => Promise<void>) => {
    const ctx = getCtx(c);
    const err = checkRole(ctx, allowed);
    return err ?? next();
  };
}

export function requireFeature(featureKey: GymFeatureKey) {
  return async (c: AuthContext, next: () => Promise<void>) => {
    const tenant = c.get('tenant');
    if (!tenant) return jsonError('Tenant not resolved', 500);
    if (!tenant.enabledFeatures.includes(featureKey)) {
      return jsonError(`Feature "${featureKey}" is disabled for this gym.`, 403);
    }
    return next();
  };
}

export function getTenant(c: AuthContext) {
  return c.get('tenant');
}

export const requireSuperAdminMiddleware: MiddlewareHandler<{ Bindings: AppEnv; Variables: AuthVars }> = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonError('Missing or invalid Authorization header', 401);
  }
  const session = await verifySessionToken(authHeader.substring(7), c.env.JWT_SECRET);
  if (!session) return jsonError('Invalid or expired session token', 401);
  setUser(c, payloadToSessionUser(session), session.gymId ?? undefined);

  if (session.role !== 'PLATFORM_ADMIN') {
    return jsonError('Platform Super Admin privileges required', 403);
  }
  return next();
};