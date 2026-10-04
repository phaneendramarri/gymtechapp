// filepath: apps/api/src/middleware/auth.ts
import type { MiddlewareHandler, Context } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { AppEnv } from '../app';
import { verifySessionToken, payloadToSessionUser } from '../lib/session';
import { readCookie, COOKIE_NAMES } from '../lib/cookies';
import type { Gym, License, GymFeatureKey, UserRole } from '@gymtech/shared';
import { parseEnabledFeatures } from '../lib/features';
import { getCtx, setUser, type RequestContext } from './context';
import { jsonError, checkRole, isPlatformAdmin, isMemberSession, hasUnrestrictedGymAccess } from '../lib/roles';
import { auditSaasFromCtx } from '../services/audit.service';

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
  const secret = c.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    console.error('JWT_SECRET is missing or too short — rejecting all sessions');
    throw jsonError('Server authentication is not configured', 500);
  }
  const iss = c.env.APP_URL ?? 'gymtech';
  const session = await verifySessionToken(token, secret, { iss, aud: 'gymtech-api' });
  if (!session) throw jsonError('Invalid or expired session token', 401);

  // Phase 3.5c: Check jti has not been revoked server-side (DB check)
  if (session.jti) {
    const now = Math.floor(Date.now() / 1000);
    const dbSession = await c.env.DB
      .prepare(`SELECT 1 FROM userSessions WHERE tokenHash = ? AND revokedAt IS NULL AND expiresAt > ?`)
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
    if (session.role === 'MEMBER') {
      // Member-portal sessions identify rows in `members`, NOT `users`.
      // Checking the users table here would 401 every member whose numeric
      // id doesn't collide with a staff row (and wrongly borrow the status
      // of one that does).
      const dbMember: any = await c.env.DB
        .prepare(`SELECT status, deletedAt FROM members WHERE id = ? AND gymId = ?`)
        .bind(session.id, session.gymId)
        .first<{ status: string; deletedAt: number | null }>();
      const deletedAt = dbMember?.deletedAt ?? null;
      if (!dbMember || deletedAt !== null) {
        return jsonError('Member account has been archived or deleted', 401);
      }
      if (dbMember.status === 'BLOCKED') {
        return jsonError('Member account is currently blocked by administrator', 403);
      }
    } else {
      const dbUser: any = await c.env.DB
        .prepare(`SELECT status, deletedAt FROM users WHERE id = ? AND gymId = ?`)
        .bind(session.id, session.gymId)
        .first<{ status: string; deletedAt: number | null }>();
      const deletedAt = dbUser?.deletedAt ?? null;
      if (!dbUser || deletedAt !== null) {
        return jsonError('User account has been archived or deleted', 401);
      }
      if (dbUser.status === 'DISABLED') {
        return jsonError('User account is currently disabled by administrator', 403);
      }
    }
  }

  setUser(c, payloadToSessionUser(session), session.gymId ?? undefined);
  return next();
};

interface CachedTenantEntry {
  tenant: TenantResolution;
  expiresAt: number;
}

const tenantCache = new Map<number, CachedTenantEntry>();
const TENANT_CACHE_TTL_MS = 60_000;

export function invalidateTenantCache(gymId?: number): void {
  if (gymId) {
    tenantCache.delete(gymId);
  } else {
    tenantCache.clear();
  }
}

async function resolveTenant(
  db: D1Database,
  gymId: number
): Promise<{ tenant?: TenantResolution; error?: Response }> {
  const now = Date.now();
  const cached = tenantCache.get(gymId);
  if (cached && cached.expiresAt > now) {
    if (
      cached.tenant.gym.status === 'ACTIVE' &&
      cached.tenant.license.status === 'ACTIVE' &&
      cached.tenant.license.expiresAt >= Math.floor(now / 1000)
    ) {
      return { tenant: cached.tenant };
    }
  }

  const gym = await db
    .prepare(`SELECT * FROM gyms WHERE id = ? AND deletedAt IS NULL`)
    .bind(gymId)
    .first<Gym>();
  if (!gym) {
    return { error: jsonError('Gym tenant is not accessible. Contact the platform administrator.', 403) };
  }
  if (gym.status !== 'ACTIVE') {
    return { error: jsonError(`This gym tenant is currently ${gym.status}.`, 403) };
  }

  const license = await db
    .prepare(`SELECT * FROM licenses WHERE gymId = ?`)
    .bind(gymId)
    .first<License>();
  if (!license) {
    return { error: jsonError('No license is configured for this gym', 403) };
  }
  if (license.status !== 'ACTIVE') {
    return { error: jsonError(`Gym license is ${license.status}.`, 403) };
  }
  if (license.expiresAt < Math.floor(Date.now() / 1000)) {
    return { error: jsonError('Gym license has expired.', 403) };
  }

  const enabledFeatures: GymFeatureKey[] = parseEnabledFeatures(license.features);
  const tenant: TenantResolution = { gym: { ...gym, enabledFeatures }, license, enabledFeatures };
  tenantCache.set(gymId, { tenant, expiresAt: now + TENANT_CACHE_TTL_MS });
  return { tenant };
}

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
      .prepare(`SELECT id FROM gyms WHERE id = ? AND deletedAt IS NULL LIMIT 1`)
      .bind(gymId)
      .first();
    if (!gymExists) {
      return jsonError('Target gym does not exist or has been deactivated', 403);
    }

    // Enforce platformAdmins.authorizedGyms restriction when configured
    const adminRecord: any = await c.env.DB
      .prepare(`SELECT status, deletedAt, authorizedGyms FROM platformAdmins WHERE id = ? LIMIT 1`)
      .bind(user.id)
      .first<{ status: string | null; deletedAt: number | null; authorizedGyms: string | null }>();
    if (!adminRecord || adminRecord.deletedAt !== null || adminRecord.status !== 'ACTIVE') {
      return jsonError('Platform admin account is not active', 403);
    }
    const authorizedGymsStr = adminRecord?.authorizedGyms;
    if (authorizedGymsStr) {
      try {
        const allowedGyms = JSON.parse(authorizedGymsStr);
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
    const resolved = await resolveTenant(c.env.DB, gymId);
    if (resolved.error) return resolved.error;

    c.set('tenant', resolved.tenant!);
    return next();
  }

  if (!session.gymId) {
    return jsonError('User is not assigned to a gym tenant', 403);
  }
  // The session row was verified above, but the underlying staff/member
  // account may have been disabled or archived since the token was minted.
  // Re-check here (requireAuth does the same) so a stale JWT cannot bypass
  // deactivation — every business route goes through requireGym.
  if (session.role === 'MEMBER') {
    const dbMember: any = await c.env.DB
      .prepare(`SELECT status, deletedAt FROM members WHERE id = ? AND gymId = ?`)
      .bind(session.id, session.gymId)
      .first<{ status: string; deletedAt: number | null }>();
    if (!dbMember || (dbMember.deletedAt ?? null) !== null) {
      return jsonError('Member account has been archived or deleted', 401);
    }
    if (dbMember.status === 'BLOCKED') {
      return jsonError('Member account is currently blocked by administrator', 403);
    }
  } else {
    const dbUser: any = await c.env.DB
      .prepare(`SELECT status, deletedAt FROM users WHERE id = ? AND gymId = ?`)
      .bind(session.id, session.gymId)
      .first<{ status: string; deletedAt: number | null }>();
    if (!dbUser || (dbUser.deletedAt ?? null) !== null) {
      return jsonError('User account has been archived or deleted', 401);
    }
    if (dbUser.status === 'DISABLED') {
      return jsonError('User account is currently disabled by administrator', 403);
    }
  }
  setUser(c, user, session.gymId);

  // Load role permissions (platform admins are excluded above and have permissions: ['*']).
  // M4 fix: always reload from DB to avoid stale JWT-embedded permissions.
  // DB role perms are the authoritative source; JWT perms are additive fallback only.
  if ((user as any).roleId) {
    const roleId = (user as any).roleId as number;
    const roleRow: any = await c.env.DB
      .prepare(`SELECT permissions, isOwner FROM roles WHERE id = ? AND gymId = ? AND deletedAt IS NULL`)
      .bind(roleId, session.gymId)
      .first<{ permissions: string; isOwner: number }>();
    if (roleRow) {
      user.isOwner = Boolean(roleRow.isOwner);
      if (user.isOwner) {
        user.permissions = ['*'];
      } else {
        try {
          const roleMenuRows = await c.env.DB
            .prepare(
              `SELECT m.key FROM roleMenus rm
               JOIN menuItems m ON m.id = rm.menuItemId
               WHERE rm.gymId = ? AND rm.roleId = ? AND m.isActive = 1`
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

  const resolved = await resolveTenant(c.env.DB, session.gymId);
  if (resolved.error) return resolved.error;

  c.set('tenant', resolved.tenant!);
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
  const cached = tenantCache.get(gymId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tenant.enabledFeatures;
  }
  const row = await db
    .prepare(`SELECT features FROM licenses WHERE gymId = ? LIMIT 1`)
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

/**
 * Allow member-portal sessions through, and require `permission` for everyone
 * else.
 *
 * Endpoints the portal shares with the staff console (browse the timetable, book
 * a class) need both audiences. The handler must then pin member-scoped ids to
 * the session — never to the request body — so a member can only act on their
 * own rows.
 */
export function requirePermissionOrMember(permission: string) {
  return async (c: AuthContext, next: () => Promise<void>) => {
    if (isMemberSession(getCtx(c).user)) return next();
    return requirePermission(permission)(c, next);
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

  if (!isPlatformAdmin(session)) {
    return jsonError('Platform Super Admin privileges required', 403);
  }

  // A JWT alone is not enough: the admin row may have been disabled or
  // archived since the token was minted. Re-check the DB on every call.
  const adminRow: any = await c.env.DB
    .prepare(`SELECT status, deletedAt FROM platformAdmins WHERE id = ? LIMIT 1`)
    .bind(session.id)
    .first<{ status: string | null; deletedAt: number | null }>();
  if (!adminRow || adminRow.deletedAt !== null || adminRow.status !== 'ACTIVE') {
    return jsonError('Platform admin account is not active', 403);
  }

  setUser(c, payloadToSessionUser(session), session.gymId ?? undefined);

  return next();
};