/**
 * Role repository — owner-defined roles per gym.
 *
 * Permissions are stored as a JSON array on the roles.permissions column,
 * not in a separate junction table. This avoids an extra join at runtime.
 */
import { eq, and, isNull, sql } from 'drizzle-orm';
import type { Database, D1Database } from '../db/client';
import { createDatabase } from '../db/client';
import { roles } from '../db/schema';
import type { Role } from '@gymtech/shared';

export class RoleRepository {
  private db: Database;

  constructor(db: Database | D1Database) {
    this.db = (db as any).prepare ? createDatabase(db as D1Database) : (db as Database);
  }

  async findById(id: number): Promise<Role | null> {
    const rows = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.id, id), isNull(roles.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByGymId(gymId: number): Promise<Role[]> {
    return this.db
      .select()
      .from(roles)
      .where(and(eq(roles.gymId, gymId), isNull(roles.deletedAt)))
      .orderBy(roles.createdAt);
  }

  async findByName(gymId: number, name: string): Promise<Role | null> {
    const rows = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.gymId, gymId), eq(roles.name, name.trim()), isNull(roles.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: {
    gymId: number
    name: string
    permissions: string[]
    isDefault?: boolean
    createdBy?: number
  }): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const [row] = await this.db
      .insert(roles)
      .values({
        gymId: data.gymId,
        name: data.name.trim(),
        permissions: JSON.stringify(data.permissions ?? []),
        isDefault: data.isDefault ?? false,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: roles.id });
    return row.id;
  }

  async update(
    id: number,
    data: {
      name?: string
      permissions?: string[]
      isDefault?: boolean
    }
  ): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const setCols: Record<string, unknown> = { updatedAt: now };
    if (data.name !== undefined) setCols.name = data.name.trim();
    if (data.permissions !== undefined) setCols.permissions = JSON.stringify(data.permissions);
    if (data.isDefault !== undefined) setCols.isDefault = data.isDefault;

    const result = await this.db
      .update(roles)
      .set(setCols)
      .where(and(eq(roles.id, id), isNull(roles.deletedAt)));
    return true; // D1 update doesn't return row count reliably
  }

  async softDelete(id: number): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .update(roles)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(roles.id, id), isNull(roles.deletedAt)));
    return true;
  }

  async getPermissions(roleId: number): Promise<string[]> {
    const role = await this.findById(roleId);
    if (!role) return [];
    try {
      return JSON.parse(role.permissions) as string[];
    } catch {
      return [];
    }
  }
}
