import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  History,
  UserCog,
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
import { cn } from '@/lib/utils';
import { Logo } from '@/components/shared/Logo';
import { useRecentRoutes } from '@/hooks/useRecentRoutes';
import type { UserRole } from '@gymtech/shared';

type NavRole = 'OWNER' | 'MANAGER' | 'STAFF' | 'TRAINER' | 'PLATFORM_ADMIN';

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: NavRole[];
  shortcut?: string;
  badge?: string;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const ALL: NavRole[] = ['OWNER', 'MANAGER', 'STAFF', 'TRAINER'];
const STAFF: NavRole[] = ['OWNER', 'MANAGER', 'STAFF'];

const navGroups: NavGroup[] = [
  {
    items: [
      { key: 'dashboard', label: 'Dashboard', href: '#/dashboard', icon: LayoutDashboard, roles: ALL, shortcut: '1' },
    ],
  },
  {
    label: 'Operate',
    items: [
      { key: 'members', label: 'Members', href: '#/members', icon: Users, roles: ALL, shortcut: '2' },
      { key: 'attendance', label: 'Floor', href: '#/attendance', icon: CalendarCheck, roles: ALL, shortcut: '3' },
      { key: 'payments', label: 'Payments', href: '#/payments', icon: CreditCard, roles: STAFF, shortcut: '5' },
      { key: 'pt', label: 'PT Collections', href: '#/pt-collections', icon: Trophy, roles: ['OWNER', 'MANAGER', 'TRAINER'] as NavRole[] },
    ],
  },
  {
    label: 'Configure',
    items: [
      { key: 'plans', label: 'Plans', href: '#/plans', icon: Tag, roles: ['OWNER', 'MANAGER'] as NavRole[] },
      { key: 'staff', label: 'Staff', href: '#/staff', icon: UserCog, roles: ['OWNER'] as NavRole[] },
      { key: 'reports', label: 'Reports', href: '#/reports', icon: BarChart3, roles: ['OWNER'] as NavRole[] },
      { key: 'settings', label: 'Settings', href: '#/settings/notifications', icon: Settings, roles: ['OWNER'] as NavRole[] },
      { key: 'settings', label: 'Audit Logs', href: '#/audit-logs', icon: History, roles: ['OWNER'] as NavRole[] },
    ],
  },
];

export const AppSidebar: React.FC<AppSidebarProps> = ({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { gym, user, logout } = useAuth();
  const { recent, clear: clearRecent } = useRecentRoutes();

  const isAllowed = (item: NavItem) => {
    if (!user) return false;
    if (user.role === 'PLATFORM_ADMIN') return false;
    if (!item.roles.includes(user.role as UserRole as NavRole)) return false;

    // Feature gating check: if gym has enabled_features specified, verify item is enabled
    if (gym?.enabled_features && item.key) {
      const featureKey = item.key === 'pt' ? 'pt_collections' : item.key;
      if (!gym.enabled_features.includes(featureKey as any)) {
        return false;
      }
    }
    return true;
  };

  const isActive = (href: string) => location.pathname === href.replace('#', '');

  const renderItem = (item: NavItem, mode: 'rail' | 'drawer') => {
    if (!isAllowed(item)) return null;
    const active = isActive(item.href);
    const content = (
      <a
        href={item.href}
        className={cn(
          'gt-nav-link',
          mode === 'rail' ? 'justify-center' : '',
          collapsed && mode === 'rail' ? 'px-0' : ''
        )}
        data-active={active}
      >
        <item.icon
          className={cn(
            'h-4 w-4 shrink-0',
            active ? 'text-ink' : 'text-ink-3'
          )}
        />
        {(!collapsed || mode === 'drawer') && (
          <span className="flex-1 truncate">{item.label}</span>
        )}
        {(!collapsed || mode === 'drawer') && item.shortcut && (
          <kbd className="hidden lg:inline-block text-[10px] font-mono text-ink-3 bg-[var(--surface-2)] border border-[var(--line)] rounded px-1.5 h-[18px] leading-[16px]">
            {item.shortcut}
          </kbd>
        )}
        {(!collapsed || mode === 'drawer') && item.badge && (
          <span className="gt-chip gt-chip-iron h-[18px] text-[10px]">{item.badge}</span>
        )}
      </a>
    );

    if (collapsed && mode === 'rail') {
      return (
        <TooltipProvider key={item.key} delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              <p>{item.label}</p>
              {item.shortcut && (
                <p className="text-[10px] text-muted-foreground mt-0.5">⌘{item.shortcut}</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return <React.Fragment key={item.key}>{content}</React.Fragment>;
  };

  const renderGroup = (group: NavGroup, mode: 'rail' | 'drawer') => {
    const visible = group.items.filter((i) => isAllowed(i));
    if (visible.length === 0) return null;
    return (
      <div className="flex flex-col gap-0.5">
        {group.label && (!collapsed || mode === 'drawer') && (
          <div className="gt-nav-section">{group.label}</div>
        )}
        {visible.map((i) => renderItem(i, mode))}
      </div>
    );
  };

  const userInitial = (user?.name?.[0] || 'U').toUpperCase();
  const fullName = user?.name || 'User';
  const roleLabel = user?.role || '—';

  const body = (
    <div className="h-full flex flex-col">
      {/* Brand */}
      <div className={cn(
        'h-16 flex items-center border-b border-[var(--line)] shrink-0',
        collapsed ? 'justify-center px-1' : 'px-4 gap-2.5'
      )}>
        <a href="#/dashboard" className="flex items-center group/logo">
          <Logo size="sm" showText={!collapsed || mobileOpen} />
        </a>
        {mobileOpen && (
          <button
            onClick={onCloseMobile}
            className="ml-auto h-8 w-8 rounded-md text-ink-3 hover:bg-[var(--surface-2)] hover:text-ink flex items-center justify-center"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Gym switcher (only when expanded) */}
      {(!collapsed || mobileOpen) && gym && (
        <div className="px-3 pt-3">
          <div className="gt-card p-2.5 flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-[var(--surface-2)] text-ink-2 flex items-center justify-center text-xs font-semibold shrink-0">
              {gym.name?.[0] || 'G'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink truncate">{gym.name}</p>
              <p className="text-[10px] text-ink-3 mt-0.5 flex items-center gap-1">
                <span className="gt-dot gt-dot-positive h-1.5 w-1.5" /> Live
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-4">
        {navGroups.map((g, i) => (
          <React.Fragment key={i}>{renderGroup(g, mobileOpen ? 'drawer' : 'rail')}</React.Fragment>
        ))}

        {/* Recent routes */}
        {(!collapsed || mobileOpen) && recent.length > 0 && (
          <div className="flex flex-col gap-0.5 mt-2">
            <div className="flex items-center justify-between gt-nav-section">
              <span>Recent</span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  clearRecent();
                }}
                className="text-[10px] font-normal text-ink-3 hover:text-ink normal-case tracking-normal"
              >
                Clear
              </button>
            </div>
            {recent.slice(0, 4).map((r) => (
              <a
                key={r.href}
                href={r.href}
                className="gt-nav-link text-xs"
                data-active={isActive(r.href)}
              >
                <History className="h-3.5 w-3.5 text-ink-3 shrink-0" />
                <span className="truncate">{r.label}</span>
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* Footer user */}
      <div className={cn('border-t border-[var(--line)] p-3 shrink-0', collapsed && !mobileOpen ? 'flex justify-center' : '')}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {collapsed && !mobileOpen ? (
              <button
                className="h-9 w-9 rounded-full bg-[var(--surface-2)] text-ink-2 flex items-center justify-center text-xs font-semibold"
                aria-label="Account menu"
              >
                {userInitial}
              </button>
            ) : (
              <button className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-[var(--surface-2)] transition-colors">
                <div className="h-8 w-8 rounded-full bg-[var(--iron)] text-[var(--iron-ink)] flex items-center justify-center text-xs font-semibold shrink-0">
                  {userInitial}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-xs font-semibold text-ink truncate">{fullName}</p>
                  <p className="text-[10px] text-ink-3 mt-0.5 truncate">{roleLabel}</p>
                </div>
              </button>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="right" className="w-56 text-xs">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-ink-3">
              {fullName}
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => navigate('/settings/notifications')}>
              <Settings className="h-3.5 w-3.5 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout()} className="text-danger focus:text-danger">
              <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          'hidden md:flex shrink-0 border-r border-[var(--line)] bg-[var(--surface)] relative z-10',
          collapsed ? 'w-[60px]' : 'w-[224px]'
        )}
      >
        {body}
        <button
          onClick={onToggleCollapsed}
          className="absolute -right-3 top-16 h-6 w-6 rounded-full border border-[var(--line)] bg-[var(--surface)] text-ink-3 hover:text-ink flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="md:hidden fixed inset-0 bg-black/40 z-40"
              onClick={onCloseMobile}
            />
            <motion.aside
              key="drawer"
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden fixed left-0 top-0 bottom-0 w-[260px] bg-[var(--surface)] z-50 border-r border-[var(--line)]"
            >
              {body}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
