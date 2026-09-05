/**
 * Menu Repository — queries menu_groups + menu_items and builds
 * a filtered, grouped menu tree for the current user.
 */

import { Database } from '../db/client';
import { menuGroups, menuItems } from '../db/schema';
import { eq, asc, and } from 'drizzle-orm';
import type { MenuNode, GymFeatureKey } from '@gymtech/shared';

export interface DbMenuGroup {
  key: string;
  label: string;
  icon: string;
  order: number;
}

export interface DbMenuItem {
  key: string;
  groupKey: string;
  label: string;
  href: string | null;
  icon: string | null;
  order: number;
  permissions: string[];
  featureKey: string | null;
  adminOnly: boolean;
}

/** Raw row shape from the DB (mirrors drizzle select aliases) */
interface MenuItemRow {
  key: string;
  group_key: string;
  group_label: string;
  group_icon: string;
  group_order: number;
  label: string;
  href: string | null;
  icon: string | null;
  item_order: number;
  permissions: string;
  feature_key: string | null;
  admin_only: number | boolean;
}

// Module-level cache shared across all MenuRepository instances.
// Menu structure rarely changes — cached for 60 seconds to avoid D1 queries on every menu request.
// C5 fix: per-gym cache so menu mutations by one gym don't affect another gym's cached menu.
const menuCache = new Map<number, { menu: MenuNode[]; fetchedAt: number }>();
const MENU_CACHE_TTL_MS = 60_000; // 60 seconds

export class MenuRepository {
  constructor(private db: Database) {}

  /**
   * Fetch full menu tree (all active items), ordered for sidebar display.
   * Result is cached per gymId for 60s to avoid repeated D1 reads.
   */
  async getFullMenu(gymId: number): Promise<MenuNode[]> {
    // Return cached menu for this gym if still fresh
    const cached = menuCache.get(gymId);
    if (cached && Date.now() - cached.fetchedAt < MENU_CACHE_TTL_MS) {
      return cached.menu;
    }

    const rows = await this.db
      .select({
        key: menuItems.key,
        group_key: menuItems.groupKey,
        group_label: menuGroups.label,
        group_icon: menuGroups.icon,
        group_order: menuGroups.order,
        label: menuItems.label,
        href: menuItems.href,
        icon: menuItems.icon,
        item_order: menuItems.order,
        permissions: menuItems.permissions,
        feature_key: menuItems.featureKey,
        admin_only: menuItems.adminOnly,
      })
      .from(menuItems)
      .innerJoin(menuGroups, eq(menuItems.groupKey, menuGroups.key))
      .where(and(eq(menuItems.isActive, true), eq(menuGroups.isActive, true)))
      .orderBy(asc(menuGroups.order), asc(menuItems.order));

    const menu = this.buildTree(rows as MenuItemRow[]);

    // Update per-gym cache
    menuCache.set(gymId, { menu, fetchedAt: Date.now() });

    return menu;
  }

  /**
   * Filter menu tree by user permissions + feature flags.
   *
   * PLATFORM_ADMIN (wildcard permission) sees everything including adminOnly items.
   * Feature-gated items are shown only if the gym has that feature enabled.
   */
  filterMenu(
    menu: MenuNode[],
    userPermissions: string[],
    enabledFeatures: string[] = [],
    isPlatformAdmin: boolean = false,
  ): MenuNode[] {
    const permSet = new Set(userPermissions);
    const featureSet = new Set(enabledFeatures);

    function isItemAllowed(item: MenuNode): boolean {
      if (isPlatformAdmin) return true;
      if (item.adminOnly) return false;
      if (item.featureKey && !featureSet.has(item.featureKey)) return false;
      if (!item.permissions.every((p) => permSet.has(p))) return false;
      return true;
    }

    function filterNode(node: MenuNode): MenuNode | null {
      // Leaf node
      if (!node.children || node.children.length === 0) {
        return isItemAllowed(node) ? node : null;
      }

      // Group: filter children, include only if at least one survives
      const filteredChildren = node.children
        .map((child) => filterNode(child))
        .filter((n): n is MenuNode => n !== null);

      if (filteredChildren.length === 0) return null;

      return { ...node, children: filteredChildren };
    }

    return menu.map((node) => filterNode(node)).filter((n): n is MenuNode => n !== null);
  }

  private buildTree(rows: MenuItemRow[]): MenuNode[] {
    const groupMap = new Map<string, MenuNode>();

    for (const row of rows) {
      if (!groupMap.has(row.group_key)) {
        groupMap.set(row.group_key, {
          key: row.group_key,
          label: row.group_label,
          icon: row.group_icon,
          permissions: [],
          children: [],
        });
      }

      const href = row.href && row.href.trim() !== '' ? row.href : undefined;

      groupMap.get(row.group_key)!.children!.push({
        key: row.key,
        label: row.label,
        href,
        icon: row.icon ?? undefined,
        permissions: this.parsePermissions(row.permissions),
        featureKey: (row.feature_key ?? undefined) as GymFeatureKey | undefined,
        adminOnly: Boolean(row.admin_only),
      });
    }

    return Array.from(groupMap.values()).sort((a, b) => {
      const aOrder = rows.find((r) => r.group_key === a.key)?.group_order ?? 0;
      const bOrder = rows.find((r) => r.group_key === b.key)?.group_order ?? 0;
      return aOrder - bOrder;
    });
  }

  private parsePermissions(raw: string): string[] {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }

  /**
   * Invalidate the menu cache — call this after any menu/group/item mutation
   * so the next /api/menu request fetches fresh data.
   */
  invalidateCache(): void {
    menuCache.clear();
  }

  // ----- Admin CRUD methods -----

  async listGroups(): Promise<DbMenuGroup[]> {
    return this.db
      .select()
      .from(menuGroups)
      .where(eq(menuGroups.isActive, true))
      .orderBy(asc(menuGroups.order));
  }

  async getGroupById(id: number): Promise<{ id: number; key: string; label: string; icon: string; order: number } | null> {
    const rows = await this.db
      .select()
      .from(menuGroups)
      .where(eq(menuGroups.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async createGroup(data: { key: string; label: string; icon: string; order: number }): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const [row] = await this.db
      .insert(menuGroups)
      .values({ ...data, isActive: true, createdAt: now, updatedAt: now })
      .returning({ id: menuGroups.id });
    return row.id;
  }

  async updateGroup(id: number, data: Partial<{ label: string; icon: string; order: number }>): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .update(menuGroups)
      .set({ ...data, updatedAt: now })
      .where(eq(menuGroups.id, id));
  }

  async deleteGroup(id: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .update(menuGroups)
      .set({ isActive: false, updatedAt: now })
      .where(eq(menuGroups.id, id));
  }

  async restoreGroup(id: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .update(menuGroups)
      .set({ isActive: true, updatedAt: now })
      .where(eq(menuGroups.id, id));
  }

  async listItems(groupKey?: string): Promise<(typeof menuItems.$inferSelect & { permissions: string })[]> {
    const cond = groupKey
      ? and(eq(menuItems.groupKey, groupKey), eq(menuItems.isActive, true))
      : eq(menuItems.isActive, true);
    return this.db
      .select()
      .from(menuItems)
      .where(cond)
      .orderBy(asc(menuItems.order));
  }

  async getItemById(id: number): Promise<(typeof menuItems.$inferSelect & { permissions: string }) | null> {
    const rows = await this.db
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async createItem(data: {
    groupKey: string; key: string; label: string; href: string | null;
    icon: string | null; order: number; permissions: string[];
    featureKey: string | null; adminOnly: boolean;
  }): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const [row] = await this.db
      .insert(menuItems)
      .values({
        groupKey: data.groupKey,
        key: data.key,
        label: data.label,
        href: data.href,
        icon: data.icon,
        order: data.order,
        permissions: JSON.stringify(data.permissions),
        featureKey: data.featureKey,
        adminOnly: data.adminOnly,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: menuItems.id });
    return row.id;
  }

  async updateItem(
    id: number,
    data: Partial<{
      label: string; href: string | null; icon: string | null;
      order: number; permissions: string[]; featureKey: string | null;
      adminOnly: boolean; isActive: boolean;
    }>
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const setCols: Record<string, unknown> = { updatedAt: now };
    if (data.label !== undefined) setCols.label = data.label;
    if (data.href !== undefined) setCols.href = data.href;
    if (data.icon !== undefined) setCols.icon = data.icon;
    if (data.order !== undefined) setCols.order = data.order;
    if (data.permissions !== undefined) setCols.permissions = JSON.stringify(data.permissions);
    if (data.featureKey !== undefined) setCols.featureKey = data.featureKey;
    if (data.adminOnly !== undefined) setCols.adminOnly = data.adminOnly;
    if (data.isActive !== undefined) setCols.isActive = data.isActive;

    await this.db.update(menuItems).set(setCols).where(eq(menuItems.id, id));
  }

  async restoreItem(id: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .update(menuItems)
      .set({ isActive: true, updatedAt: now })
      .where(eq(menuItems.id, id));
  }

  async deleteItem(id: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .update(menuItems)
      .set({ isActive: false, updatedAt: now })
      .where(eq(menuItems.id, id));
  }
}
