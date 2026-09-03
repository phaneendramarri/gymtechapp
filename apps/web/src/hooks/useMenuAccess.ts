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

    // Clean nodes to remove parameterized routes like :id from sidebar navigation
    function cleanTree(nodes: MenuNode[]): MenuNode[] {
      return nodes
        .map((node) => {
          const children = node.children ? cleanTree(node.children) : undefined;
          return { ...node, children };
        })
        .filter((node) => {
          // Keep if it has children with at least 1 item
          if (node.children && node.children.length > 0) return true;
          // If it's a leaf, keep only if href exists and has no unreplaced :params
          return Boolean(node.href && !node.href.includes(':'));
        });
    }

    const filtered = cleanTree(menu);

    // Collect all leaf nodes with href for router helpers
    function collectLeaves(nodes: MenuNode[]): MenuNode[] {
      return nodes.flatMap((n) => (n.children ? collectLeaves(n.children) : [n]));
    }

    const visibleItems = collectLeaves(filtered).filter((n) => !!n.href);

    const hasPermission = (key: string): boolean => {
      if (isPlatformAdmin) return true;
      return userPerms.has(key);
    };

    return { visibleItems, filteredTree: filtered, hasPermission };
  }, [user, menu]);
}

