"use client";

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Tag,
  CreditCard,
  BarChart3,
  Settings,
  X,
  LogOut,
  Trophy,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Bell,
  Sliders,
  Building2,
  Shield,
  Key,
  Download,
  PlusCircle,
  Menu as MenuIcon,
  Folder,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/shared/Logo';
import type { MenuNode } from '@gymtech/shared';

/**
 * Server-driven icon resolver for MenuNode[].
 */
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Tag,
  CreditCard,
  BarChart3,
  Settings,
  X,
  LogOut,
  Trophy,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Bell,
  Sliders,
  Building2,
  Shield,
  Key,
  Download,
  PlusCircle,
  Menu: MenuIcon,
  Folder,
};

function resolveIcon(name?: string): LucideIcon {
  if (name && name in ICON_MAP) return ICON_MAP[name];
  return Folder;
}

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  requiredPermission?: string;
}

const MAIN_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'members', label: 'Members', href: '/members', icon: Users, requiredPermission: 'members' },
  { key: 'floor', label: 'Floor & Attendance', href: '/attendance', icon: CalendarCheck, requiredPermission: 'attendance' },
  { key: 'payments', label: 'Payments', href: '/payments', icon: CreditCard, requiredPermission: 'payments' },
  { key: 'pt', label: 'PT Sessions', href: '/pt-collections', icon: Trophy, requiredPermission: 'pt_collections' },
  { key: 'plans', label: 'Plans', href: '/plans', icon: Tag, requiredPermission: 'plans' },
  { key: 'reports', label: 'Reports', href: '/reports', icon: BarChart3, requiredPermission: 'reports' },
];

const ADMIN_NAV: NavItem[] = [
  { key: 'staff', label: 'Staff Management', href: '/staff', icon: UserCog, requiredPermission: 'staff' },
  { key: 'communications', label: 'Communications', href: '/communications', icon: Bell, requiredPermission: 'settings' },
  { key: 'audit_logs', label: 'Audit Logs', href: '/audit-logs', icon: Sliders, requiredPermission: 'audit_logs' },
  { key: 'settings', label: 'Settings', href: '/settings/notifications', icon: Settings, requiredPermission: 'settings' },
];

const PLATFORM_ADMIN_NAV: NavItem[] = [
  { key: 'admin_gyms', label: 'Gyms & Tenants', href: '/admin', icon: Building2 },
  { key: 'platform_users', label: 'Platform Users', href: '/platform/users', icon: Users },
  { key: 'platform_roles', label: 'Roles & Governance', href: '/platform/roles', icon: Shield },
  { key: 'platform_menus', label: 'Menu Management', href: '/platform/menus', icon: MenuIcon },
];

export interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}) => {
  const location = useLocation();
  const { gym, user, menu, logout } = useAuth();

  const isSuperAdmin = user?.role === 'PLATFORM_ADMIN' || user?.permissions?.includes('superadmin');
  const isOwner = user?.role === 'OWNER';
  const showPlatformNav = isSuperAdmin || (isOwner && location.pathname.startsWith('/admin'));

  const isActive = (href: string) => {
    if (href === '/dashboard') return location.pathname === '/dashboard';
    if (href === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(href);
  };

  const hasAccess = (item: NavItem) => {
    if (isSuperAdmin || isOwner) return true;
    if (!item.requiredPermission) return true;
    return user?.permissions?.includes(item.requiredPermission) ?? false;
  };

  const NavItemComponent: React.FC<{
    item: NavItem;
    collapsedMode?: boolean;
    onClick?: () => void;
  }> = ({ item, collapsedMode = false, onClick }) => {
    const active = isActive(item.href);

    const content = (
      <Link
        to={item.href}
        onClick={onClick}
        className={cn(
          'group relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none',
          active
            ? 'bg-primary/10 text-primary font-semibold dark:bg-primary/20'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
          collapsedMode ? 'h-9 w-9 justify-center px-0 mx-auto' : 'h-9 px-3 w-full'
        )}
      >
        <item.icon
          className={cn(
            'h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-105',
            active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
          )}
        />
        {!collapsedMode && <span className="truncate flex-1">{item.label}</span>}
        {!collapsedMode && item.badge && (
          <span className="ml-auto text-[10px] bg-primary/15 text-primary rounded-full px-1.5 py-0.5 font-mono">
            {item.badge}
          </span>
        )}
        {active && !collapsedMode && (
          <motion.div
            layoutId="sidebar-active-indicator"
            className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary"
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
      </Link>
    );

    if (collapsedMode) {
      return (
        <Tooltip delayDuration={50}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={12} className="font-medium text-xs">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  // Mobile drawer content
  const MobileDrawerContent: React.FC = () => (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Mobile Drawer Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <Logo size="sm" className="shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm text-foreground truncate">
              {gym?.name || 'GymTech'}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono leading-none">
              Gym Management
            </span>
          </div>
        </div>
        <button
          onClick={onCloseMobile}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground flex items-center justify-center transition-colors"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mobile Navigation List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {menu.length > 0 ? (
          menu.map((node) => {
            const Icon = resolveIcon(node.icon);
            if (node.children && node.children.length > 0) {
              return (
                <div key={node.key} className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1 font-mono">
                    {node.label}
                  </p>
                  {node.children.map((child) => (
                    <NavItemComponent
                      key={child.key}
                      item={{
                        key: child.key,
                        label: child.label,
                        href: child.href || '#',
                        icon: resolveIcon(child.icon),
                      }}
                      onClick={onCloseMobile}
                    />
                  ))}
                </div>
              );
            }
            return (
              <NavItemComponent
                key={node.key}
                item={{ key: node.key, label: node.label, href: node.href || '#', icon: Icon }}
                onClick={onCloseMobile}
              />
            );
          })
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1 font-mono">
                Operations
              </p>
              {MAIN_NAV.filter(hasAccess).map((item) => (
                <NavItemComponent key={item.key} item={item} onClick={onCloseMobile} />
              ))}
            </div>

            <div className="space-y-1 pt-2 border-t border-border/50">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1 font-mono">
                Management
              </p>
              {ADMIN_NAV.filter(hasAccess).map((item) => (
                <NavItemComponent key={item.key} item={item} onClick={onCloseMobile} />
              ))}
            </div>

            {showPlatformNav && (
              <div className="space-y-1 pt-2 border-t border-border/50">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1 font-mono">
                  Platform
                </p>
                {PLATFORM_ADMIN_NAV.map((item) => (
                  <NavItemComponent key={item.key} item={item} onClick={onCloseMobile} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Mobile Drawer Footer with User Info */}
      {user && (
        <div className="p-3 border-t border-border shrink-0">
          <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 border border-border/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                {user.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
                <p className="text-[10px] text-muted-foreground truncate capitalize">
                  {user.role?.toLowerCase().replace('_', ' ')}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      {/* Mobile drawer (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onCloseMobile()}>
        <SheetContent side="left" className="w-72 p-0 border-r border-border bg-sidebar flex flex-col">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <MobileDrawerContent />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar rail */}
      <aside
        className={cn(
          'hidden md:flex flex-col h-screen sticky top-0 border-r border-border bg-sidebar transition-all duration-200 ease-in-out z-20 shrink-0 select-none',
          collapsed ? 'w-16' : 'w-60'
        )}
        aria-label="Main Navigation"
      >
        {/* Brand / Tenant Header */}
        <div
          className={cn(
            'flex items-center h-14 sm:h-16 border-b border-border shrink-0 transition-all',
            collapsed ? 'justify-center px-0' : 'px-4 justify-between gap-2'
          )}
        >
          <Link
            to="/dashboard"
            className={cn(
              'flex items-center gap-2.5 min-w-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md',
              collapsed ? 'justify-center' : ''
            )}
          >
            <Logo size="sm" className="shrink-0 transition-transform duration-200 group-hover:scale-105" />
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-foreground truncate max-w-[130px]">
                    {gym?.name || 'GymTech'}
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 h-4 border-border bg-secondary/50">
                    Live
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono leading-none">
                  Admin Console
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation Group Items */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {menu.length > 0 ? (
            menu.map((node) => {
              const Icon = resolveIcon(node.icon);
              if (node.children && node.children.length > 0) {
                return (
                  <div key={node.key} className="space-y-1">
                    {!collapsed && (
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1 font-mono">
                        {node.label}
                      </p>
                    )}
                    {node.children.map((child) => (
                      <NavItemComponent
                        key={child.key}
                        item={{
                          key: child.key,
                          label: child.label,
                          href: child.href || '#',
                          icon: resolveIcon(child.icon),
                        }}
                        collapsedMode={collapsed}
                      />
                    ))}
                  </div>
                );
              }
              return (
                <NavItemComponent
                  key={node.key}
                  item={{ key: node.key, label: node.label, href: node.href || '#', icon: Icon }}
                  collapsedMode={collapsed}
                />
              );
            })
          ) : (
            <>
              {/* Operations Group */}
              <div className="space-y-1">
                {!collapsed && (
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1 font-mono">
                    Operations
                  </p>
                )}
                {MAIN_NAV.filter(hasAccess).map((item) => (
                  <NavItemComponent key={item.key} item={item} collapsedMode={collapsed} />
                ))}
              </div>

              {/* Management Group */}
              <div className="space-y-1 pt-2 border-t border-border/50">
                {!collapsed && (
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1 font-mono">
                    Management
                  </p>
                )}
                {ADMIN_NAV.filter(hasAccess).map((item) => (
                  <NavItemComponent key={item.key} item={item} collapsedMode={collapsed} />
                ))}
              </div>

              {/* Platform Group */}
              {showPlatformNav && (
                <div className="space-y-1 pt-2 border-t border-border/50">
                  {!collapsed && (
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1 font-mono">
                      Platform
                    </p>
                  )}
                  {PLATFORM_ADMIN_NAV.map((item) => (
                    <NavItemComponent key={item.key} item={item} collapsedMode={collapsed} />
                  ))}
                </div>
              )}
            </>
          )}
        </nav>

        {/* Sidebar Footer — Collapse Toggle */}
        <div className="p-2 border-t border-border shrink-0">
          <button
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex items-center gap-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              collapsed ? 'h-9 w-9 justify-center mx-auto' : 'h-9 px-3 w-full'
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 shrink-0" />
                <span className="truncate">Collapse sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
};

// Backwards compatibility alias
export const AppSidebarNew = AppSidebar;
export type AppSidebarNewProps = AppSidebarProps;

