/**
 * User repository — Drizzle ORM query builder.
 *
 * Raw SQL (this.db.prepare(...)) is replaced with Drizzle's type-safe
 * query builder. Complex dynamic WHERE clauses use the sql`` template tag
 * to keep parameterized queries while preserving readability.
 *
 * NOTE: We use Drizzle as a query builder only — migrations are hand-written
 * SQL under migrations/. The schema.ts file provides full type inference.
 */
import { eq, and, isNull, inArray, sql } from 'drizzle-orm';
import type { Database, D1Database } from '../db/client';
import { createDatabase } from '../db/client';
import type { User } from '@gymtech/shared';
import { users, userPermissions, platformAdmins, roles } from '../db/schema';
import type { PlatformAdmin } from '../db/schema';

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
  permissions: string[];
};

export class UserRepository {
  private db: Database;

  constructor(db: Database | D1Database) {
    this.db = (db as any).prepare ? createDatabase(db as D1Database) : (db as Database);
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email.toLowerCase().trim()), isNull(users.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findById(id: number): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByIdFull(id: number): Promise<(User & { roleName: string | null }) | null> {
    const rows = await this.db
      .select({
        id: users.id,
        gymId: users.gymId,
        name: users.name,
        email: users.email,
        phone: users.phone,
        roleId: users.roleId,
        role: users.role,
        status: users.status,
        isOwner: users.isOwner,
        permissions: users.permissions,
        lastLoginAt: users.lastLoginAt,
        failedLoginCount: users.failedLoginCount,
        lockedUntil: users.lockedUntil,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    if (!rows[0]) return null;
    const u = rows[0] as any;

    let roleName: string | null = null;
    if (u.roleId) {
      const roleRows = await this.db
        .select({ name: roles.name })
        .from(roles)
        .where(and(eq(roles.id, u.roleId), isNull(roles.deletedAt)))
        .limit(1);
      roleName = roleRows[0]?.name ?? null;
    }
    return { ...u, roleName };
  }

  async update(id: number, data: Partial<{ roleId: number | null; status: 'ACTIVE' | 'DISABLED'; disabledAt: number | null }>): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const setCols: Record<string, unknown> = { updatedAt: now };
    if (data.roleId !== undefined) setCols.roleId = data.roleId;
    if (data.status !== undefined) setCols.status = data.status;
    if (data.disabledAt !== undefined) setCols.status = data.disabledAt ? 'DISABLED' : 'ACTIVE';
    await this.db.update(users).set(setCols).where(eq(users.id, id));
  }

  async listAllPlatformUsers(opts: {
    page: number; limit: number; search?: string; gymId?: number;
  }): Promise<{ users: (User & { roleName: string | null; gymName: string | null })[]; total: number }> {
    const { page, limit, gymId, search } = opts;
    const offset = (page - 1) * limit;

    // Import gym schema here to avoid circular deps
    const { gyms } = await import('../db/schema');

    const conds: any[] = [isNull(users.deletedAt)];
    if (gymId) {
      conds.push(eq(users.gymId, gymId));
    }
    if (search) {
      const term = `%${search.toLowerCase().trim()}%`;
      conds.push(sql`(${users.name} LIKE ${term} OR ${users.email} LIKE ${term} OR ${users.phone} LIKE ${term})`);
    }
    const whereCond = and(...conds);

    // Filtered count
    const countRows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereCond);
    const total = Number(countRows[0]?.count ?? 0);

    // Paginated fetch
    const rows = await this.db
      .select({
        id: users.id,
        gymId: users.gymId,
        name: users.name,
        email: users.email,
        phone: users.phone,
        roleId: users.roleId,
        role: users.role,
        status: users.status,
        isOwner: users.isOwner,
        permissions: users.permissions,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(whereCond)
      .orderBy(users.createdAt)
      .limit(limit)
      .offset(offset);

    if (rows.length === 0) return { users: [], total };

    // Resolve role names
    const roleIds = [...new Set(rows.map((u) => u.roleId).filter((r): r is number => r !== null))];
    const roleRows = roleIds.length
      ? await this.db.select({ id: roles.id, name: roles.name }).from(roles).where(inArray(roles.id, roleIds))
      : [];
    const roleMap = new Map(roleRows.map((r) => [r.id, r.name]));

    // Resolve gym names
    const gymIds = [...new Set(rows.map((u) => u.gymId))];
    const gymRows = await this.db
      .select({ id: gyms.id, name: gyms.name })
      .from(gyms)
      .where(inArray(gyms.id, gymIds));
    const gymMap = new Map(gymRows.map((g) => [g.id, g.name]));

    return {
      users: rows.map((u) => ({
        ...(u as any),
        roleName: u.roleId ? (roleMap.get(u.roleId) ?? null) : null,
        gymName: gymMap.get(u.gymId) ?? null,
      })),
      total,
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

  async listGymStaff(gymId: number): Promise<StaffListItem[]> {
    const staffRows = await this.db
      .select({
        id: users.id,
        gymId: users.gymId,
        name: users.name,
        email: users.email,
        phone: users.phone,
        roleId: users.roleId,
        role: users.role,
        status: users.status,
        isOwner: users.isOwner,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(eq(users.gymId, gymId), isNull(users.deletedAt)))
      .orderBy(users.createdAt);

    if (staffRows.length === 0) return [];

    const ids = staffRows.map((u) => u.id);
    const permRows = await this.db
      .select({ userId: userPermissions.userId, permissionKey: userPermissions.permissionKey })
      .from(userPermissions)
      .where(and(inArray(userPermissions.userId, ids), isNull(userPermissions.deletedAt)));

    const permMap: Record<number, string[]> = {};
    for (const row of permRows) {
      if (!permMap[row.userId]) permMap[row.userId] = [];
      permMap[row.userId].push(row.permissionKey);
    }

    return staffRows.map((u) => ({ ...u, permissions: permMap[u.id] ?? [] }));
  }

  async getPermissionsForUser(userId: number): Promise<string[]> {
    // 1. Direct per-user permission grants
    const userPermRows = await this.db
      .select({ permissionKey: userPermissions.permissionKey })
      .from(userPermissions)
      .where(and(eq(userPermissions.userId, userId), isNull(userPermissions.deletedAt)));
    const userPerms = userPermRows.map((r) => r.permissionKey);

    // 2. Role permissions (merged with user perms — deduplicated via Set)
    const userRow = await this.db
      .select({ roleId: users.roleId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (userRow[0]?.roleId) {
      const roleRow = await this.db
        .select({ permissions: roles.permissions })
        .from(roles)
        .where(and(eq(roles.id, userRow[0].roleId), isNull(roles.deletedAt)))
        .limit(1);
      if (roleRow[0]) {
        try {
          const rolePerms = JSON.parse(roleRow[0].permissions) as string[];
          return [...new Set([...rolePerms, ...userPerms])];
        } catch {
          // Ignore parse errors — fall through to user perms only
        }
      }
    }

    return userPerms;
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

  async upgradePasswordHash(
    id: number,
    gymId: number,
    newHash: string,
  ): Promise<void> {
    await this.db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: Math.floor(Date.now() / 1000) })
      .where(and(eq(users.id, id), eq(users.gymId, gymId)));
  }

  async upgradePlatformAdminPasswordHash(
    id: number,
    newHash: string,
  ): Promise<void> {
    await this.db
      .update(platformAdmins)
      .set({ passwordHash: newHash, updatedAt: Math.floor(Date.now() / 1000) })
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

  async create(
    data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt' | 'failedLoginCount' | 'lockedUntil' | 'deletedAt' | 'passwordHash'> & {
      passwordHash: string;
    }
  ): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const row = await this.db
      .insert(users)
      .values({
        gymId: data.gymId,
        name: data.name,
        email: data.email.toLowerCase().trim(),
        phone: data.phone ?? null,
        passwordHash: data.passwordHash,
        roleId: (data as any).roleId ?? null,
        role: data.role as string,
        status: 'ACTIVE',
        permissions: data.permissions ?? '{}',
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: users.id });
    return row[0]!.id;
  }

  /**
   * Grant a permission key to a user (idempotent — upsert on composite PK).
   */
  async grantPermission(userId: number, permissionKey: string, grantedBy: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .insert(userPermissions)
      .values({ userId, permissionKey, grantedBy, grantedAt: now })
      .onConflictDoUpdate({
        target: [userPermissions.userId, userPermissions.permissionKey],
        // M-8: Clear deletedAt to undelete if this permission was previously revoked.
        set: { grantedBy, grantedAt: now, deletedAt: null },
      });
  }

  /**
   * Revoke a specific permission from a user.
   * M-8: Soft-delete instead of hard-delete.
   */
  async revokePermission(userId: number, permissionKey: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .update(userPermissions)
      .set({ deletedAt: now })
      .where(and(eq(userPermissions.userId, userId), eq(userPermissions.permissionKey, permissionKey), isNull(userPermissions.deletedAt)));
  }

  /**
   * Sync all permissions for a user (replaces existing grant set).
   * M-8: Soft-deletes existing permissions, then upserts new ones (undeleting any
   * previously revoked permissions that are being re-granted).
   */
  async setPermissions(userId: number, permissionKeys: string[], grantedBy: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    // Soft-delete all existing (non-deleted) permissions for this user.
    await this.db
      .update(userPermissions)
      .set({ deletedAt: now })
      .where(and(eq(userPermissions.userId, userId), isNull(userPermissions.deletedAt)));
    if (permissionKeys.length > 0) {
      await this.db.insert(userPermissions).values(
        permissionKeys.map((key) => ({ userId, permissionKey: key, grantedBy, grantedAt: now }))
      ).onConflictDoUpdate({
        target: [userPermissions.userId, userPermissions.permissionKey],
        set: { grantedBy, grantedAt: now, deletedAt: null },
      });
    }
  }
}
