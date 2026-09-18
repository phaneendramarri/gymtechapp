/**
 * User repository — Drizzle ORM query builder.
 *
 * STRUCTURE (keep it this way):
 *   `projectUserRow`  the ONLY place a user row becomes an API shape
 *   `userDtoColumns`  the shared column set for serialisable reads
 *   `findByEmail`     the only read that returns the password hash
 *   `findById`        single user, safe to serialise
 *   `listGymStaff` / `listAllPlatformUsers`  joins, never follow-up queries
 *
 * Role resolution is NOT implemented here: `deriveCoarseRole` and
 * `resolvePermissions` live in `lib/roles.ts` and own that policy. This file
 * only wires columns to those functions.
 *
 * NOTE: We use Drizzle as a query builder only — migrations are hand-written
 * SQL under migrations/. The schema.ts file provides full type inference.
 */
import { eq, and, isNull, sql } from 'drizzle-orm';
import type { Database, D1Database } from '../db/client';
import { createDatabase } from '../db/client';
import type { User, UserRole } from '@gymtech/shared';
import { users, platformAdmins, roles, gyms } from '../db/schema';
import type { PlatformAdmin } from '../db/schema';
import { deriveCoarseRole, resolvePermissions } from '../lib/roles';

/**
 * A user as the API exposes it: the password hash is deliberately absent and the
 * coarse role is derived from the assigned role rather than stored.
 */
export type UserDto = Omit<User, 'passwordHash'> & {
  role: UserRole;
  roleName: string | null;
};

export type StaffListItem = {
  id: number;
  gymId: number;
  name: string;
  email: string;
  phone: string | null;
  roleId: number | null;
  role: string;
  status: 'ACTIVE' | 'DISABLED';
  isOwner: boolean;
  lastLoginAt: number | null;
  createdAt: number;
  updatedAt: number;
  /** Effective permission keys, resolved from the assigned role (owners: all). */
  permissions: string[];
  /** Name of the assigned role, when one is set. */
  roleName: string | null;
};

/** Columns every serialisable user read shares — never the password hash. */
const userDtoColumns = {
  id: users.id,
  gymId: users.gymId,
  name: users.name,
  email: users.email,
  phone: users.phone,
  roleId: users.roleId,
  status: users.status,
  isOwner: users.isOwner,
  lastLoginAt: users.lastLoginAt,
  failedLoginCount: users.failedLoginCount,
  lockedUntil: users.lockedUntil,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  deletedAt: users.deletedAt,
  roleName: roles.name,
  roleIsOwner: roles.isOwner,
} as const;

/**
 * The ONLY place a user's role is resolved into an API shape.
 *
 * Reads JOIN `roles` (never a per-row follow-up query) and hand the joined row
 * here. Adding a new read path means reusing this — not re-deriving.
 */
function projectUserRow<T extends { roleName?: string | null; roleIsOwner?: boolean | null }>(
  row: T
) {
  const { roleName = null, roleIsOwner = null, ...rest } = row;
  return {
    ...rest,
    roleName,
    role: deriveCoarseRole({
      isOwner: (rest as { isOwner?: boolean }).isOwner,
      roleIsOwner,
      roleName,
    }),
  } as Omit<T, 'roleName' | 'roleIsOwner'> & { roleName: string | null; role: UserRole };
}

export class UserRepository {
  private db: Database;

  constructor(db: Database | D1Database) {
    this.db = (db as any).prepare ? createDatabase(db as D1Database) : (db as Database);
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  /**
   * Look up a user for authentication — the only read that returns the password
   * hash, so the result must never be serialised to a client.
   */
  async findByEmail(email: string): Promise<(UserDto & { passwordHash: string }) | null> {
    const rows = await this.db
      .select({ ...userDtoColumns, passwordHash: users.passwordHash })
      .from(users)
      .leftJoin(roles, eq(roles.id, users.roleId))
      .where(and(eq(users.email, email.toLowerCase().trim()), isNull(users.deletedAt)))
      .limit(1);
    return rows[0] ? (projectUserRow(rows[0]) as UserDto & { passwordHash: string }) : null;
  }

  /** Single user by id. Safe to serialise — no password hash is selected. */
  async findById(id: number): Promise<UserDto | null> {
    const rows = await this.db
      .select(userDtoColumns)
      .from(users)
      .leftJoin(roles, eq(roles.id, users.roleId))
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return rows[0] ? projectUserRow(rows[0]) : null;
  }

  async listGymStaff(gymId: number): Promise<StaffListItem[]> {
    const staffRows = await this.db
      .select({ ...userDtoColumns, rolePermissions: roles.permissions })
      .from(users)
      .leftJoin(roles, eq(roles.id, users.roleId))
      .where(and(eq(users.gymId, gymId), isNull(users.deletedAt)))
      .orderBy(users.createdAt);

    return staffRows.map((row) => {
      const { rolePermissions, ...rest } = row;
      return {
        ...projectUserRow(rest),
        permissions: resolvePermissions({
          isOwner: row.isOwner,
          rolePermissionsJson: rolePermissions,
        }),
      } as StaffListItem;
    });
  }

  async listAllPlatformUsers(opts: {
    page: number; limit: number; search?: string; gymId?: number;
  }): Promise<{ users: (UserDto & { gymName: string | null })[]; total: number }> {
    const { page, limit } = opts;
    const offset = (page - 1) * limit;
    const baseCond = isNull(users.deletedAt);

    const countRows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(baseCond);

    // One query: user + role + gym, so no follow-up lookups or id→name maps.
    const rows = await this.db
      .select({ ...userDtoColumns, gymName: gyms.name })
      .from(users)
      .leftJoin(roles, eq(roles.id, users.roleId))
      .leftJoin(gyms, eq(gyms.id, users.gymId))
      .where(baseCond)
      .orderBy(users.createdAt)
      .limit(limit)
      .offset(offset);

    return {
      users: rows.map((row) => {
        const { gymName, ...rest } = row;
        return { ...projectUserRow(rest), gymName: gymName ?? null };
      }),
      total: Number(countRows[0]?.count ?? 0),
    };
  }

  async findPlatformAdminByEmail(email: string): Promise<(typeof platformAdmins.$inferSelect) | null> {
    const rows = await this.db
      .select()
      .from(platformAdmins)
      .where(and(eq(platformAdmins.email, email.toLowerCase().trim()), isNull(platformAdmins.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async listPlatformAdmins(): Promise<Pick<PlatformAdmin, 'id' | 'email' | 'name' | 'status' | 'createdAt'>[]> {
    return this.db
      .select({
        id: platformAdmins.id,
        email: platformAdmins.email,
        name: platformAdmins.name,
        status: platformAdmins.status,
        createdAt: platformAdmins.createdAt,
      })
      .from(platformAdmins)
      .where(isNull(platformAdmins.deletedAt));
  }

  /**
   * Effective permission keys for a user — resolved by the same policy the
   * staff list uses, so the session payload and the UI can never disagree.
   */
  async getPermissionsForUser(userId: number): Promise<string[]> {
    const rows = await this.db
      .select({ isOwner: users.isOwner, rolePermissions: roles.permissions })
      .from(users)
      .leftJoin(roles, eq(roles.id, users.roleId))
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    const row = rows[0];
    if (!row) return [];
    return resolvePermissions({ isOwner: row.isOwner, rolePermissionsJson: row.rolePermissions });
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  async create(data: {
    gymId: number;
    name: string;
    email: string;
    phone?: string | null;
    passwordHash: string;
    roleId?: number | null;
    isOwner?: boolean;
    status?: 'ACTIVE' | 'DISABLED';
  }): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const row = await this.db
      .insert(users)
      .values({
        gymId: data.gymId,
        name: data.name,
        email: data.email.toLowerCase().trim(),
        phone: data.phone ?? null,
        passwordHash: data.passwordHash,
        roleId: data.roleId ?? null,
        isOwner: data.isOwner ?? false,
        status: data.status ?? 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: users.id });
    return row[0]!.id;
  }

  async update(id: number, data: Partial<{ roleId: number | null; status: 'ACTIVE' | 'DISABLED' }>): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const setCols: Record<string, unknown> = { updatedAt: now };
    if (data.roleId !== undefined) setCols.roleId = data.roleId;
    if (data.status !== undefined) setCols.status = data.status;
    await this.db.update(users).set(setCols).where(eq(users.id, id));
  }

  async updateStaff(
    id: number,
    gymId: number,
    data: Partial<{
      name: string;
      phone: string | null;
      roleId: number | null;
      status: 'ACTIVE' | 'DISABLED';
    }>
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const setCols: Record<string, unknown> = { updatedAt: now };
    if (data.name !== undefined) setCols.name = data.name;
    if (data.phone !== undefined) setCols.phone = data.phone;
    if (data.roleId !== undefined) setCols.roleId = data.roleId;
    if (data.status !== undefined) setCols.status = data.status;
    await this.db.update(users).set(setCols).where(and(eq(users.id, id), eq(users.gymId, gymId)));
  }

  /** Detach every user in a gym from a role being deleted. */
  async clearRoleAssignment(gymId: number, roleId: number): Promise<void> {
    await this.db
      .update(users)
      .set({ roleId: null, updatedAt: Math.floor(Date.now() / 1000) })
      .where(and(eq(users.gymId, gymId), eq(users.roleId, roleId), isNull(users.deletedAt)));
  }

  async updateLastLogin(id: number): Promise<void> {
    await this.db
      .update(users)
      .set({ lastLoginAt: Math.floor(Date.now() / 1000) })
      .where(eq(users.id, id));
  }

  async incrementFailedLogin(id: number, gymId: number): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const row = await this.db
      .update(users)
      .set({
        failedLoginCount: sql`CASE
          WHEN ${users.lockedUntil} IS NOT NULL AND ${users.lockedUntil} > ${now}
          THEN ${users.failedLoginCount} + 1
          ELSE 1
        END`,
        updatedAt: now,
      })
      .where(and(eq(users.id, id), eq(users.gymId, gymId)))
      .returning({ failedLoginCount: users.failedLoginCount });
    return row[0]?.failedLoginCount ?? 0;
  }

  async resetFailedLogin(id: number, gymId: number): Promise<void> {
    await this.db
      .update(users)
      .set({ failedLoginCount: 0, lockedUntil: null, updatedAt: Math.floor(Date.now() / 1000) })
      .where(and(eq(users.id, id), eq(users.gymId, gymId)));
  }

  async setLockUntil(id: number, gymId: number, untilUnix: number): Promise<void> {
    await this.db
      .update(users)
      .set({ lockedUntil: untilUnix, updatedAt: Math.floor(Date.now() / 1000) })
      .where(and(eq(users.id, id), eq(users.gymId, gymId)));
  }

  async incrementPlatformAdminFailedLogin(id: number): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const row = await this.db
      .update(platformAdmins)
      .set({
        failedLoginCount: sql`CASE
          WHEN ${platformAdmins.lockedUntil} IS NOT NULL AND ${platformAdmins.lockedUntil} > ${now}
          THEN ${platformAdmins.failedLoginCount} + 1
          ELSE 1
        END`,
        updatedAt: now,
      })
      .where(eq(platformAdmins.id, id))
      .returning({ failedLoginCount: platformAdmins.failedLoginCount });
    return row[0]?.failedLoginCount ?? 0;
  }

  async resetPlatformAdminFailedLogin(id: number): Promise<void> {
    await this.db
      .update(platformAdmins)
      .set({ failedLoginCount: 0, lockedUntil: null, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(platformAdmins.id, id));
  }

  async setPlatformAdminLockUntil(id: number, untilUnix: number): Promise<void> {
    await this.db
      .update(platformAdmins)
      .set({ lockedUntil: untilUnix, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(platformAdmins.id, id));
  }

  async upgradePasswordHash(id: number, gymId: number, newHash: string): Promise<void> {
    await this.db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: Math.floor(Date.now() / 1000) })
      .where(and(eq(users.id, id), eq(users.gymId, gymId)));
  }

  async upgradePlatformAdminPasswordHash(id: number, newHash: string): Promise<void> {
    await this.db
      .update(platformAdmins)
      .set({ passwordHash: newHash, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(platformAdmins.id, id));
  }

  async touchPlatformAdminLogin(id: number): Promise<void> {
    await this.db
      .update(platformAdmins)
      .set({ lastLoginAt: Math.floor(Date.now() / 1000) })
      .where(eq(platformAdmins.id, id));
  }

  async softDelete(id: number, gymId: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .update(users)
      .set({ deletedAt: now, status: 'DISABLED' as any, updatedAt: now })
      .where(and(eq(users.id, id), eq(users.gymId, gymId)));
  }

  async restore(id: number, gymId: number): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const row = await this.db
      .update(users)
      .set({ deletedAt: null, status: 'ACTIVE' as any, updatedAt: now })
      .where(and(eq(users.id, id), eq(users.gymId, gymId), sql`${users.deletedAt} IS NOT NULL`))
      .returning({ id: users.id });
    return (row[0]?.id ?? null) !== null;
  }
}
