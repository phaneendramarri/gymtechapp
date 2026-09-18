// filepath: apps/api/src/middleware/auth.ts
import type { MiddlewareHandler, Context } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { AppEnv } from '../app';
import { verifySessionToken, payloadToSessionUser } from '../lib/session';
import { readCookie, COOKIE_NAMES } from '../lib/cookies';
import type { Gym, License, GymFeatureKey, UserRole } from '@gymtech/shared';
import { parseEnabledFeatures } from '../lib/features';
import { getCtx, setUser, type RequestContext } from './context';
import { jsonError, checkRole, isPlatformAdmin, hasUnrestrictedGymAccess } from '../lib/roles';
import { auditSaasFromCtx } from '../services/audit.service';

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

/**
 * H-3: Shared JWT verification and session revocation check.
 * All three middleware entry points (requireAuth, requireGym, requireSuperAdminMiddleware)
 * share this same verification path — factoring it out eliminates duplication.
 *
 * Returns the verified session payload, or throws a jsonError Response on failure.
 */
async function verifySession(c: Context<{ Bindings: AppEnv; Variables: AuthVars }>) {
  const token = extractJwt(c);
  if (!token) {
    throw jsonError('Missing or invalid session credential', 401);
  }
  const iss = c.env.APP_URL ?? 'gymtech';
  const session = await verifySessionToken(token, c.env.JWT_SECRET, { iss, aud: 'gymtech-api' });
  if (!session) throw jsonError('Invalid or expired session token', 401);

  // Phase 3.5c: Check jti has not been revoked server-side (DB check)
  if (session.jti) {
    const now = Math.floor(Date.now() / 1000);
    const dbSession = await c.env.DB
      .prepare(`SELECT 1 FROM user_sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`)
      .bind(session.jti, now)
      .first();
    if (!dbSession) throw jsonError('Session has been revoked', 401);

    // Phase 3.5d: Also check KV denylist for faster revocation without a DB round-trip
    if (c.env.DENYLIST_KV) {
      const denied = await c.env.DENYLIST_KV.get(`denylist:${session.jti}`);
      if (denied) throw jsonError('Session has been revoked', 401);
    }
  }
  return session;
}

export const requireAuth: MiddlewareHandler<{ Bindings: AppEnv; Variables: AuthVars }> = async (c, next) => {
  const ctx = getCtx(c);
  if (ctx.user && ctx.gymId !== undefined) return next();

  // H-3: Use shared verification helper to avoid duplicating JWT + revocation checks.
  let session;
  try {
    session = await verifySession(c);
  } catch (e) {
    return e as Response;
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

  // H-3: Use shared verification helper to avoid duplicating JWT + revocation checks.
  let session;
  try {
    session = await verifySession(c);
  } catch (e) {
    return e as Response;
  }

  setUser(c, payloadToSessionUser(session), session.gymId ?? undefined);

  // Resolve gymId: platform admins use ?gymId= query param to scope themselves;
  // regular users always have gymId set in their JWT.
  const user = payloadToSessionUser(session);
  if (isPlatformAdmin(user)) {
    const gymIdParam = c.req.query('gymId');
    if (!gymIdParam) {
      return jsonError('Platform admin must specify target gym via ?gymId= query parameter', 400);
    }
    const gymId = Number(gymIdParam);
    if (!gymId || !Number.isInteger(gymId)) {
      return jsonError('Invalid gymId parameter', 400);
    }

    const gymExists = await c.env.DB
      .prepare(`SELECT id FROM gyms WHERE id = ? AND deleted_at IS NULL LIMIT 1`)
      .bind(gymId)
      .first();
    if (!gymExists) {
      return jsonError('Target gym does not exist or has been deactivated', 403);
    }

    // Enforce platform_admins.authorized_gyms restriction when configured
    const adminRecord = await c.env.DB
      .prepare(`SELECT authorized_gyms FROM platform_admins WHERE id = ? AND deleted_at IS NULL LIMIT 1`)
      .bind(user.id)
      .first<{ authorized_gyms: string | null }>();
    if (adminRecord?.authorized_gyms) {
      try {
        const allowedGyms = JSON.parse(adminRecord.authorized_gyms);
        if (Array.isArray(allowedGyms) && allowedGyms.length > 0 && !allowedGyms.includes(gymId)) {
          return jsonError('You are not authorized to access this gym', 403);
        }
      } catch {
        return jsonError('Invalid authorization configuration', 403);
      }
    }

    setUser(c, user, gymId);

    // H-11: Audit trail for platform admin cross-gym access
    try {
      await auditSaasFromCtx(c, 'platform_admin.access_gym', gymId);
    } catch (e) {
      console.warn('Cross-gym audit log failed:', (e as Error).message);
    }

    // Platform admins bypass all permission and feature checks but still need
    // gym resolution for the tenant object (powers feature flags, license status).
    // These 4 DB calls are the minimum needed — role lookup is skipped because
    // platform admins already have permissions: ['*'] hardcoded in auth.service.ts.
    const gym = await c.env.DB
      .prepare(`SELECT * FROM gyms WHERE id = ? AND deleted_at IS NULL`)
      .bind(gymId)
      .first<Gym>();
    if (!gym) return jsonError('Gym tenant is not accessible. Contact the platform administrator.', 403);
    if (gym.status !== 'ACTIVE') return jsonError(`This gym tenant is currently ${gym.status}.`, 403);

    const license = await c.env.DB
      .prepare(`SELECT * FROM licenses WHERE gym_id = ?`)
      .bind(gymId)
      .first<License>();
    if (!license) return jsonError('No license is configured for this gym', 403);
    if (license.status !== 'ACTIVE') return jsonError(`Gym license is ${license.status}.`, 403);
    if (license.expiresAt < Math.floor(Date.now() / 1000)) return jsonError('Gym license has expired.', 403);

    // Feature flags come from the license; an empty map means "all enabled".
    const enabledFeatures: GymFeatureKey[] = parseEnabledFeatures(license.features);

    const tenant: TenantResolution = { gym: { ...gym, enabledFeatures }, license, enabledFeatures };
    c.set('tenant', tenant);
    return next();
  }

  if (!session.gymId) {
    return jsonError('User is not assigned to a gym tenant', 403);
  }
  setUser(c, user, session.gymId);

  // Load role permissions (platform admins are excluded above and have permissions: ['*']).
  // M4 fix: always reload from DB to avoid stale JWT-embedded permissions.
  // DB role perms are the authoritative source; JWT perms are additive fallback only.
  if ((user as any).roleId) {
    const roleId = (user as any).roleId as number;
    const roleRow = await c.env.DB
      .prepare(`SELECT permissions, is_owner FROM roles WHERE id = ? AND deleted_at IS NULL`)
      .bind(roleId)
      .first<{ permissions: string; is_owner: number }>();
    if (roleRow) {
      user.isOwner = Boolean(roleRow.is_owner);
      if (user.isOwner) {
        user.permissions = ['*'];
      } else {
        try {
          const roleMenuRows = await c.env.DB
            .prepare(
              `SELECT m.key FROM role_menus rm
               JOIN menu_items m ON m.id = rm.menu_item_id
               WHERE rm.gym_id = ? AND rm.role_id = ? AND m.is_active = 1`
            )
            .bind(session.gymId, roleId)
            .all<{ key: string }>();

          const dbKeys = (roleMenuRows.results || []).map((r) => r.key);
          if (dbKeys.length > 0) {
            user.permissions = dbKeys;
          } else {
            user.permissions = JSON.parse(roleRow.permissions || '[]') as string[];
          }
        } catch {
          try {
            user.permissions = JSON.parse(roleRow.permissions || '[]') as string[];
          } catch {
            user.permissions = [];
          }
        }
      }
    }
  }

  const gym = await c.env.DB
    .prepare(`SELECT * FROM gyms WHERE id = ? AND deleted_at IS NULL`)
    .bind(ctx.gymId)
    .first<Gym>();
  if (!gym) {
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

  const enabledFeatures: GymFeatureKey[] = parseEnabledFeatures(license.features);

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
 * Shared helper: load a gym's enabled features from its license.
 * Used by requireGym and by routes that need features but use only requireAuth.
 */
export async function getGymFeatures(
  db: D1Database,
  gymId: number,
): Promise<GymFeatureKey[]> {
  const row = await db
    .prepare(`SELECT features FROM licenses WHERE gym_id = ? LIMIT 1`)
    .bind(gymId)
    .first<{ features: string | null }>();
  return parseEnabledFeatures(row?.features);
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

    // Bypass policy is defined once, in lib/roles.ts.
    if (hasUnrestrictedGymAccess(user)) return next();

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
    // Platform admins bypass all feature gates.
    if (isPlatformAdmin(ctx.user)) return next();

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
  // H-3: Use shared verification helper to avoid duplicating JWT + revocation checks.
  let session;
  try {
    session = await verifySession(c);
  } catch (e) {
    return e as Response;
  }

  setUser(c, payloadToSessionUser(session), session.gymId ?? undefined);

  if (!isPlatformAdmin(session)) {
    return jsonError('Platform Super Admin privileges required', 403);
  }
  return next();
};