// filepath: apps/api/src/repositories/menu.repository.ts
import { eq, and, asc, inArray } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { createDatabase, type Database } from '../db/client';
import { menuItems, roleMenus, type MenuItem } from '../db/schema';

export class MenuRepository {
  private db: Database;

  constructor(private d1: D1Database) {
    this.db = createDatabase(d1);
  }

  /**
   * Return all active menu items defined in the system.
   */
  async listMenuItems(): Promise<MenuItem[]> {
    return this.db
      .select()
      .from(menuItems)
      .where(eq(menuItems.isActive, true))
      .orderBy(asc(menuItems.order));
  }

  /**
   * Return the menu_item_ids assigned to a role.
   */
  async getRoleMenuIds(gymId: number, roleId: number): Promise<number[]> {
    const rows = await this.db
      .select({ menuItemId: roleMenus.menuItemId })
      .from(roleMenus)
      .where(and(eq(roleMenus.gymId, gymId), eq(roleMenus.roleId, roleId)));
    return rows.map((r) => r.menuItemId);
  }

  /**
   * Return the string permission/menu keys assigned to a role.
   */
  async getRoleMenuKeys(gymId: number, roleId: number): Promise<string[]> {
    const rows = await this.db
      .select({ key: menuItems.key })
      .from(roleMenus)
      .innerJoin(menuItems, eq(roleMenus.menuItemId, menuItems.id))
      .where(
        and(
          eq(roleMenus.gymId, gymId),
          eq(roleMenus.roleId, roleId),
          eq(menuItems.isActive, true)
        )
      );
    return rows.map((r) => r.key);
  }

  /** Remove a role's menu links (used when the role is deleted). */
  async clearRoleMenus(gymId: number, roleId: number): Promise<void> {
    await this.d1
      .prepare('DELETE FROM roleMenus WHERE gymId = ? AND roleId = ?')
      .bind(gymId, roleId)
      .run();
  }

  /**
   * Atomically synchronize a role's accessible menus.
   */
  async syncRoleMenus(gymId: number, roleId: number, menuItemIds: number[]): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const validMenuIds = menuItemIds.filter((id) => Number.isInteger(id) && id > 0);

    await this.d1.batch([
      this.d1
        .prepare('DELETE FROM roleMenus WHERE gymId = ? AND roleId = ?')
        .bind(gymId, roleId),
      ...validMenuIds.map((menuItemId) =>
        this.d1
          .prepare(
            'INSERT OR IGNORE INTO roleMenus (gymId, roleId, menuItemId, createdAt) VALUES (?, ?, ?, ?)'
          )
          .bind(gymId, roleId, menuItemId, now)
      ),
    ]);
  }
}
