// filepath: apps/api/src/middleware/auth.ts
import type { MiddlewareHandler, Context } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
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

  const session = await verifySessionToken(token, c.env.JWT_SECRET, {
    iss: ctx.env.APP_URL ?? 'gymtech',
    aud: 'gymtech-api',
  });
  if (!session) return jsonError('Invalid or expired session token', 401);

  // Phase 3.5c: Check jti has not been revoked server-side
  if (session.jti) {
    const now = Math.floor(Date.now() / 1000);
    const dbSession = await c.env.DB
      .prepare(`SELECT 1 FROM user_sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`)
      .bind(session.jti, now)
      .first();
    if (!dbSession) return jsonError('Session has been revoked', 401);
  }

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
  const session = await verifySessionToken(token, c.env.JWT_SECRET, {
    iss: ctx.env.APP_URL ?? 'gymtech',
    aud: 'gymtech-api',
  });
  if (!session) return jsonError('Invalid or expired session token', 401);

  // Phase 3.5c: Check jti has not been revoked server-side
  if (session.jti) {
    const now = Math.floor(Date.now() / 1000);
    const dbSession = await c.env.DB
      .prepare(`SELECT 1 FROM user_sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`)
      .bind(session.jti, now)
      .first();
    if (!dbSession) return jsonError('Session has been revoked', 401);
  }

  setUser(c, payloadToSessionUser(session), session.gymId ?? undefined);

  // Resolve gymId: platform admins use ?gymId= query param to scope themselves;
  // regular users always have gymId set in their JWT.
  const user = payloadToSessionUser(session);
  if (user.role === 'PLATFORM_ADMIN') {
    const gymIdParam = c.req.query('gymId');
    if (!gymIdParam) {
      return jsonError('Platform admin must specify target gym via ?gymId= query parameter', 400);
    }
    const gymId = Number(gymIdParam);
    if (!gymId || !Number.isInteger(gymId)) {
      return jsonError('Invalid gymId parameter', 400);
    }
    setUser(c, user, gymId);
  } else {
    if (!session.gymId) {
      return jsonError('User is not assigned to a gym tenant', 403);
    }
    setUser(c, user, session.gymId);
  }

  // Load role permissions for all gym users (owners + non-owners, excluding platform-admins).
  // Platform admins bypass all checks and have permissions: ['*'] hardcoded.
  // Owners have no universal bypass — they only see what their roleId (or individual grants) give them.
  // roleId is embedded in the JWT's session.user.roleId field (added during token minting).
  if (user.role !== 'PLATFORM_ADMIN' && (user as any).roleId) {
    const roleId = (user as any).roleId as number;
    const roleRow = await c.env.DB
      .prepare(`SELECT permissions FROM roles WHERE id = ? AND deleted_at IS NULL`)
      .bind(roleId)
      .first<{ permissions: string }>();
    if (roleRow) {
      try {
        const rolePerms = JSON.parse(roleRow.permissions) as string[];
        // Merge role permissions with user-specific overrides (dedup via Set)
        const permSet = new Set([...rolePerms, ...user.permissions]);
        user.permissions = [...permSet];
      } catch {
        // Ignore parse errors — use existing permissions
      }
    }
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
  if (license.expiresAt < Math.floor(Date.now() / 1000)) {
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

  const tenant: TenantResolution = { gym: { ...gym, enabledFeatures: enabledFeatures }, license, enabledFeatures };
  c.set('tenant', tenant);
  return next();
};

export function requireRole(...allowed: (UserRole | string)[]) {
  return async (c: AuthContext, next: () => Promise<void>) => {
    const ctx = getCtx(c);
    const err = checkRole(ctx, allowed);
    return err ?? next();
  };
}

/**
 * Shared helper: load enabled gym features from D1.
 * Used by requireGym and by routes that need features but use only requireAuth.
 */
export async function getGymFeatures(
  db: D1Database,
  gymId: number,
): Promise<GymFeatureKey[]> {
  const rows = await db
    .prepare(`SELECT feature_key FROM gym_features WHERE gym_id = ? AND is_enabled = 1`)
    .bind(gymId)
    .all<{ feature_key: string }>();
  return rows.results?.length
    ? (rows.results.map((r) => r.feature_key as GymFeatureKey))
    : [...GYM_FEATURES];
}

/**
 * Permission-based access control.
 *
 * A user passes the check when ALL of these are true:
 *   - The user has every permission key listed (AND logic)
 *   - OR the user is PLATFORM_ADMIN — bypasses all permission checks
 *
 * @example
 *   // Route accessible to any user with both 'members' AND 'attendance' permissions
 *   router.delete('/', requirePermission('members', 'attendance'), deleteMemberHandler);
 *
 *   // Route accessible to any user with 'reports' permission (owner, manager, staff… all ok)
 *   router.get('/reports', requirePermission('reports'), reportsHandler);
 */
export function requirePermission(...required: string[]) {
  return async (c: AuthContext, next: () => Promise<void>) => {
    const ctx = getCtx(c);
    const { user } = ctx;

    if (!user) return jsonError('Authentication required', 401);

    // PLATFORM_ADMIN bypasses all permission checks
    if (user.role === 'PLATFORM_ADMIN') return next();

    // Check: does the user have ALL required permission keys?
    const hasAll = required.every((key) => user.permissions?.includes(key));
    if (!hasAll) {
      return jsonError(
        `Insufficient permissions. Required: [${required.join(', ')}].`,
        403,
      );
    }

    return next();
  };
}

export function requireFeature(featureKey: GymFeatureKey) {
  return async (c: AuthContext, next: () => Promise<void>) => {
    const ctx = getCtx(c);
    // PLATFORM_ADMIN bypasses all feature gates
    if (ctx.user?.role === 'PLATFORM_ADMIN') return next();

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
  const session = await verifySessionToken(authHeader.substring(7), c.env.JWT_SECRET, {
    iss: c.env.APP_URL ?? 'gymtech',
    aud: 'gymtech-api',
  });
  if (!session) return jsonError('Invalid or expired session token', 401);

  // Phase 3.5c: Check jti has not been revoked server-side
  if (session.jti) {
    const now = Math.floor(Date.now() / 1000);
    const dbSession = await c.env.DB
      .prepare(`SELECT 1 FROM user_sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`)
      .bind(session.jti, now)
      .first();
    if (!dbSession) return jsonError('Session has been revoked', 401);
  }

  setUser(c, payloadToSessionUser(session), session.gymId ?? undefined);

  if (session.role !== 'PLATFORM_ADMIN') {
    return jsonError('Platform Super Admin privileges required', 403);
  }
  return next();
};