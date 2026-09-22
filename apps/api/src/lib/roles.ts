// filepath: apps/api/src/lib/roles.ts
/**
 * Authorization policy — the single owner of "what role does this user have,
 * and what are they allowed to do?".
 *
 * Deliberately pure: no database, no HTTP, no Hono context. That keeps it
 * unit-testable and stops policy from being re-implemented inside repositories,
 * routes or the session layer.
 *
 * Three layers, each defined exactly once:
 *
 *   vocabulary   `USER_ROLES` in @gymtech/shared — the only role-name list
 *   derivation   `deriveCoarseRole` — stored state (role_id / is_owner) → role
 *   decision     `checkRole` / `hasUnrestrictedGymAccess` — may this user act?
 *
 * History note: `users` used to carry a denormalized `role` TEXT column as a
 * second source of truth. It could not represent gym-defined custom role names
 * (a CHECK constraint rejected them) and could drift from the role it mirrored,
 * so it was removed. Authorization derives from `role_id` + `is_owner` + the
 * assigned role's `permissions`.
 */
import type { SessionUser, UserRole } from '@gymtech/shared';
import { USER_ROLES, GYM_FEATURES } from '@gymtech/shared';

export function jsonError(message: string, status = 400, extra?: Record<string, unknown> | string): Response {
  const body: Record<string, unknown> = { error: message };
  if (extra && typeof extra === 'object') Object.assign(body, extra);
  else if (typeof extra === 'string') body.details = extra;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Role names with built-in meaning, from the shared vocabulary. */
const BUILT_IN_ROLES: readonly string[] = Object.values(USER_ROLES);

// ---------------------------------------------------------------------------
// Derivation: stored state → coarse role
// ---------------------------------------------------------------------------

/**
 * Derive the coarse authorization role from a user's assigned role.
 *
 * The `roles` table lets a gym define arbitrary role names, but authorization
 * branches on a small built-in set. Priority order:
 *   1. platform admins are their own role
 *   2. the gym owner (either flag) is always OWNER
 *   3. a built-in name passes through
 *   4. a custom role buckets to STAFF — its fine-grained access comes from the
 *      role's `permissions`, not from its name
 */
export function deriveCoarseRole(input: {
  isOwner?: boolean | number | null;
  roleIsOwner?: boolean | number | null;
  roleName?: string | null;
  isPlatformAdmin?: boolean;
}): UserRole {
  if (input.isPlatformAdmin) return USER_ROLES.PLATFORM_ADMIN;
  if (input.isOwner || input.roleIsOwner) return USER_ROLES.OWNER;
  const name = (input.roleName ?? '').trim().toUpperCase();
  if (BUILT_IN_ROLES.includes(name)) return name as UserRole;
  return USER_ROLES.STAFF;
}

/**
 * Effective permission keys for a user, given the assigned role's raw JSON.
 *
 * Owners and platform admins hold every gym feature implicitly. Defined once so
 * the staff list, the session payload and any future caller cannot disagree
 * about what a user is allowed to do.
 */
export function resolvePermissions(input: {
  isOwner?: boolean | number | null;
  isPlatformAdmin?: boolean;
  rolePermissionsJson?: string | null;
}): string[] {
  if (input.isPlatformAdmin || input.isOwner) return [...GYM_FEATURES];
  if (!input.rolePermissionsJson) return [];
  try {
    const parsed = JSON.parse(input.rolePermissionsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((key): key is string => typeof key === 'string');
  } catch {
    // Malformed role JSON means no permissions, never a thrown error.
    return [];
  }
}

// ---------------------------------------------------------------------------
// Decisions: may this user act?
// ---------------------------------------------------------------------------

/** Platform operators are not tenants and bypass every gym-scoped check. */
export function isPlatformAdmin(user: { role?: string | null } | null | undefined): boolean {
  return user?.role === USER_ROLES.PLATFORM_ADMIN;
}

/**
 * Member-portal session.
 *
 * The distinguishing fact is that a member session's `id` identifies a row in
 * `members`, not in `users` — so any handler that scopes by user id must branch
 * on this before comparing ids, and any query it runs must be pinned to the
 * member's own rows rather than the gym-wide ledger.
 */
export function isMemberSession(user: { role?: string | null } | null | undefined): boolean {
  return user?.role === USER_ROLES.MEMBER;
}

/**
 * A trainer: staff whose PT view is limited to their own collections.
 * Either the role says TRAINER, or it is a non-owner staff account that has no
 * gym-wide `staff` permission.
 */
export function isPtTrainer(
  user: { role?: string | null; isOwner?: boolean; permissions?: string[] } | null | undefined
): boolean {
  if (!user || isMemberSession(user)) return false;
  if (isGymOwner(user)) return false;
  if (user.role === USER_ROLES.TRAINER) return true;
  return !user.permissions?.includes('staff');
}

/** The gym's primary owner account. */
function isGymOwner(user: { isOwner?: boolean } | null | undefined): boolean {
  return Boolean(user?.isOwner);
}

/** Platform admins and gym owners are exempt from permission and feature gates. */
export function hasUnrestrictedGymAccess(
  user: { role?: string | null; isOwner?: boolean } | null | undefined
): boolean {
  return isPlatformAdmin(user) || isGymOwner(user);
}

/**
 * Is `userRole` one of `allowedRoles`?
 * The primitive every role check is built on — defined once, on purpose.
 */
export function hasAllowedRole(
  userRole: string | null | undefined,
  allowedRoles: readonly string[]
): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

/**
 * Full role gate for a request. Returns a 401/403 `Response` to short-circuit
 * with, or `null` when the request may proceed.
 */
export function checkRole(
  ctx: { user?: SessionUser | null },
  allowed: readonly (UserRole | string)[]
) {
  if (!ctx.user) return jsonError('Authentication required', 401);
  if (isPlatformAdmin(ctx.user)) return null;
  if (!hasAllowedRole(ctx.user.role, allowed)) {
    return jsonError(
      `Access denied. Role "${ctx.user.role}" does not have permission for this action.`,
      403
    );
  }
  return null;
}
