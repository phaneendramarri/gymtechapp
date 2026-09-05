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
  Menu,
  Folder,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  Tooltip,
  TooltipContent,
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
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/shared/Logo';
import type { MenuNode } from '@gymtech/shared';

/**
 * H-17: Wire server-driven MenuNode[] to sidebar.
 * icon is a string (lucide name) stored in the DB; resolve it to a component.
 * Fallback to Folder for unknown icon names.
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
  Menu,
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
}

const MAIN_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'members', label: 'Members', href: '/members', icon: Users },
  { key: 'floor', label: 'Floor', href: '/attendance', icon: CalendarCheck },
  { key: 'payments', label: 'Payments', href: '/payments', icon: CreditCard },
  { key: 'pt', label: 'PT Sessions', href: '/pt-collections', icon: Trophy },
  { key: 'plans', label: 'Plans', href: '/plans', icon: Tag },
  { key: 'reports', label: 'Reports', href: '/reports', icon: BarChart3 },
];

const ADMIN_NAV: NavItem[] = [
  { key: 'staff', label: 'Staff', href: '/staff', icon: UserCog },
  { key: 'communications', label: 'Communications', href: '/communications', icon: Bell },
  { key: 'settings', label: 'Settings', href: '/settings/notifications', icon: Settings },
];

const PLATFORM_ADMIN_NAV: NavItem[] = [
  { key: 'platform_roles', label: 'Roles', href: '/platform/roles', icon: Shield },
  { key: 'platform_menus', label: 'Menu', href: '/platform/menus', icon: Menu },
  { key: 'platform_users', label: 'Users', href: '/platform/users', icon: Users },
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

  const isActive = (href: string) => location.pathname.startsWith(href);

  const NavItem: React.FC<{ item: NavItem; collapsed?: boolean; onClick?: () => void }> = ({
    item,
    collapsed = false,
    onClick,
  }) => {
    const active = isActive(item.href);
    const content = (
      <Link
        to={item.href}
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors relative',
          active
            ? 'bg-primary/10 text-primary dark:bg-primary/20'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          collapsed ? 'h-10 w-10 justify-center px-0' : 'h-10 px-3'
        )}
      >
        <item.icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : '')} />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {!collapsed && item.badge && (
          <span className="ml-auto text-[10px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5 font-mono">
            {item.badge}
          </span>
        )}
        {active && (
          <motion.div
            layoutId="sidebar-indicator"
            className="absolute left-0 -ml-3 h-6 w-1 rounded-r-full bg-primary"
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="ml-2">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  // Mobile sheet content
  const MobileContent: React.FC = () => (
    <div className="flex flex-col h-full">
      {/* Mobile header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Logo className="h-7 w-7" />
          <span className="font-semibold text-foreground">{gym?.name || 'GymTech'}</span>
        </div>
        <button
          onClick={onCloseMobile}
          className="h-8 w-8 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center justify-center"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation — H-17: server-driven MenuNode[] when available */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {menu.length > 0 ? (
          menu.map((node) => {
            const Icon = resolveIcon(node.icon);
            const content = (
              <NavItem
                key={node.key}
                item={{ key: node.key, label: node.label, href: node.href || '#', icon: Icon }}
                onClick={onCloseMobile}
              />
            );
            if (node.children && node.children.length > 0) {
              return (
                <div key={node.key}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-3 mb-2">
                    {node.label}
                  </p>
                  {node.children.map((child) => {
                    const ChildIcon = resolveIcon(child.icon);
                    return (
                      <NavItem
                        key={child.key}
                        item={{ key: child.key, label: child.label, href: child.href || '#', icon: ChildIcon }}
                        onClick={onCloseMobile}
                      />
                    );
                  })}
                </div>
              );
            }
            return content;
          })
        ) : (
          <>
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-3 mb-2">
                Main
              </p>
              {MAIN_NAV.map((item) => (
                <NavItem key={item.key} item={item} onClick={onCloseMobile} />
              ))}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-3 mb-2">
                Admin
              </p>
              {ADMIN_NAV.map((item) => (
                <NavItem key={item.key} item={item} onClick={onCloseMobile} />
              ))}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-3 mb-2">
                Platform
              </p>
              {PLATFORM_ADMIN_NAV.map((item) => (
                <NavItem key={item.key} item={item} onClick={onCloseMobile} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* User footer */}
      <div className="p-3 border-t border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 h-12 rounded-lg hover:bg-accent transition-colors text-left">
              <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate capitalize">
                  {user?.role?.toLowerCase().replace('_', ' ')}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="text-sm font-medium">{user?.name}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings/notifications">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={(v) => !v && onCloseMobile()}>
        <SheetContent side="left" className="w-72 p-0 flex">
          <MobileContent />
        </SheetContent>
      </Sheet>

      {/* Desktop rail */}
      <aside
        className={cn(
          'hidden md:flex flex-col h-screen sticky top-0 border-r border-border bg-background transition-all duration-200 ease-in-out',
          collapsed ? 'w-16' : 'w-56'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center h-14 border-b border-border shrink-0', collapsed ? 'justify-center px-0' : 'px-4 gap-2.5')}>
          <Logo className="h-7 w-7 shrink-0" />
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-semibold text-foreground truncate"
            >
              {gym?.name || 'GymTech'}
            </motion.span>
          )}
        </div>

        {/* Nav — H-17: server-driven MenuNode[] when available */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {menu.length > 0 ? (
            menu.map((node) => {
              const Icon = resolveIcon(node.icon);
              const item = { key: node.key, label: node.label, href: node.href || '#', icon: Icon };
              if (node.children && node.children.length > 0) {
                return (
                  <div key={node.key}>
                    {!collapsed && (
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-3 mb-2">
                        {node.label}
                      </p>
                    )}
                    {node.children.map((child) => {
                      const ChildIcon = resolveIcon(child.icon);
                      return (
                        <NavItem
                          key={child.key}
                          item={{ key: child.key, label: child.label, href: child.href || '#', icon: ChildIcon }}
                          collapsed={collapsed}
                        />
                      );
                    })}
                  </div>
                );
              }
              return <NavItem key={node.key} item={item} collapsed={collapsed} />;
            })
          ) : (
            <>
              {MAIN_NAV.map((item) => (
                <NavItem key={item.key} item={item} collapsed={collapsed} />
              ))}
              <div className="my-3 border-t border-border" />
              {ADMIN_NAV.map((item) => (
                <NavItem key={item.key} item={item} collapsed={collapsed} />
              ))}
              <div className="my-3 border-t border-border" />
              {PLATFORM_ADMIN_NAV.map((item) => (
                <NavItem key={item.key} item={item} collapsed={collapsed} />
              ))}
            </>
          )}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-border shrink-0">
          <button
            onClick={onToggleCollapsed}
            className={cn(
              'flex items-center gap-3 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
              collapsed ? 'h-10 w-10 justify-center px-0' : 'h-10 px-3 w-full'
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};

// Backwards compatibility alias
export const AppSidebarNew = AppSidebar;
export type AppSidebarNewProps = AppSidebarProps;
