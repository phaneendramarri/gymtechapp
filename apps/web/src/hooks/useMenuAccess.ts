/**
 * useMenuAccess — exposes the server-filtered menu from auth context.
 *
 * The menu is fetched once from GET /api/menu on auth init / login.
 * The server filters it based on the user's role permissions.
 *
 * hasPermission(key) checks if the user has a specific permission key.
 * PLATFORM_ADMIN (role === 'PLATFORM_ADMIN') always returns true.
 */

import { useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import type { MenuNode } from '@gymtech/shared';

export interface UseMenuAccessResult {
  /** Flat list of leaf nodes (items with href) visible to the user. */
  visibleItems: MenuNode[]
  /** Full filtered tree (groups + children) — used by the sidebar renderer. */
  filteredTree: MenuNode[]
  /** Check if user can access a specific permission key. */
  hasPermission: (key: string) => boolean
}

export function useMenuAccess(): UseMenuAccessResult {
  const { user, menu } = useAuth();

  return useMemo(() => {
    if (!user || menu.length === 0) {
      return { visibleItems: [], filteredTree: [], hasPermission: () => false };
    }

    const isPlatformAdmin = user.role === 'PLATFORM_ADMIN';
    const userPerms = new Set<string>(user.permissions ?? []);

    // Collect all leaf nodes with href for router helpers
    function collectLeaves(nodes: MenuNode[]): MenuNode[] {
      return nodes.flatMap((n) => (n.children ? collectLeaves(n.children) : [n]));
    }

    const visibleItems = collectLeaves(menu).filter((n) => !!n.href);

    const hasPermission = (key: string): boolean => {
      if (isPlatformAdmin) return true;
      return userPerms.has(key);
    };

    return { visibleItems: menu, filteredTree: menu, hasPermission };
  }, [user, menu]);
}
