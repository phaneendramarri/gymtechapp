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

export class MenuRepository {
  constructor(private db: Database) {}

  /**
   * Fetch full menu tree (all active items), ordered for sidebar display.
   */
  async getFullMenu(): Promise<MenuNode[]> {
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

    return this.buildTree(rows as MenuItemRow[]);
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
}
