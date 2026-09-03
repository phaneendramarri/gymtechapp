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
import { users, userPermissions, platformAdmins } from '../db/schema';
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
      .where(inArray(userPermissions.userId, ids));

    const permMap: Record<number, string[]> = {};
    for (const row of permRows) {
      if (!permMap[row.userId]) permMap[row.userId] = [];
      permMap[row.userId].push(row.permissionKey);
    }

    return staffRows.map((u) => ({ ...u, permissions: permMap[u.id] ?? [] }));
  }

  async getPermissionsForUser(userId: number): Promise<string[]> {
    const rows = await this.db
      .select({ permissionKey: userPermissions.permissionKey })
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId));
    return rows.map((r) => r.permissionKey);
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
    algo: 'argon2id' | 'sha256'
  ): Promise<void> {
    await this.db
      .update(users)
      .set({ passwordHash: newHash, passwordAlgo: algo, updatedAt: Math.floor(Date.now() / 1000) })
      .where(and(eq(users.id, id), eq(users.gymId, gymId)));
  }

  async upgradePlatformAdminPasswordHash(
    id: number,
    newHash: string,
    algo: 'argon2id' | 'sha256'
  ): Promise<void> {
    await this.db
      .update(platformAdmins)
      .set({ passwordHash: newHash, passwordAlgo: algo, updatedAt: Math.floor(Date.now() / 1000) })
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
    data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt' | 'failedLoginCount' | 'lockedUntil' | 'deletedAt' | 'passwordHash' | 'passwordAlgo'> & {
      passwordHash: string;
      passwordAlgo?: 'sha256' | 'argon2id';
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
        passwordAlgo: data.passwordAlgo ?? 'argon2id',
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
        set: { grantedBy, grantedAt: now },
      });
  }

  /**
   * Revoke a specific permission from a user.
   */
  async revokePermission(userId: number, permissionKey: string): Promise<void> {
    await this.db
      .delete(userPermissions)
      .where(and(eq(userPermissions.userId, userId), eq(userPermissions.permissionKey, permissionKey)));
  }

  /**
   * Sync all permissions for a user (replaces existing grant set).
   */
  async setPermissions(userId: number, permissionKeys: string[], grantedBy: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db.delete(userPermissions).where(eq(userPermissions.userId, userId));
    if (permissionKeys.length > 0) {
      await this.db.insert(userPermissions).values(
        permissionKeys.map((key) => ({ userId, permissionKey: key, grantedBy, grantedAt: now }))
      );
    }
  }
}
