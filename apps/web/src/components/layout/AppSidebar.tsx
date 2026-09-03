import React from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
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
  // ── New icons for menu tree ──
  LogIn,
  UserPlus,
  Receipt,
  Plus,
  ShieldCheck,
  Bell,
  Sliders,
  Building2,
  IdCard,
  Server,
  Shield,
  Key,
  Download,
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
import { useMenuAccess } from '@/hooks/useMenuAccess';
import { resolveIcon } from '@/lib/icons';
import type { MenuNode } from '@gymtech/shared';

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Permission keys required to see this nav item. Owner bypasses all checks. */
  permissions: string[];
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
  const { filteredTree } = useMenuAccess();

  const isActive = (href: string) => location.pathname.startsWith(href);

  /** Render a single MenuNode — returns null if the node should not be rendered. */
  const renderNode = (node: MenuNode, mode: 'rail' | 'drawer'): React.ReactNode => {
    // Group/parent node (has children) — only show if there are visible children
    if (node.children && node.children.length > 0) {
      const visibleChildren = node.children.filter(
        (child) =>
          (!child.adminOnly || user?.role === 'PLATFORM_ADMIN') &&
          (!child.href || !child.href.includes(':'))
      );
      if (visibleChildren.length === 0) return null;

      // Show as a collapsible section when collapsed
      const IconComponent = resolveIcon(node.icon);

      if (collapsed && mode === 'rail') {
        // Collapsed rail: show parent as a tooltip with child links
        const content = (
          <div className="flex flex-col gap-0.5">
            {IconComponent && (
              <div className="h-8 w-full flex items-center justify-center">
                <IconComponent className="h-4 w-4 text-ink-3" />
              </div>
            )}
          </div>
        );
        return (
          <TooltipProvider key={node.key} delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-default">{content}</div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs flex flex-col gap-1">
                <p className="font-semibold">{node.label}</p>
                {visibleChildren.map((child) =>
                  child.href ? (
                    <Link key={child.key} to={child.href} className="hover:text-foreground">
                      {child.label}
                    </Link>
                  ) : (
                    <span key={child.key} className="text-muted-foreground">{child.label}</span>
                  )
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      // Expanded: show group label + child items
      return (
        <div key={node.key} className="flex flex-col gap-0.5">
          {(!collapsed || mode === 'drawer') && (
            <div className="gt-nav-section">{node.label}</div>
          )}
          {visibleChildren.map((child) => renderNode(child, mode))}
        </div>
      );
    }

    // Leaf node (no children) — skip if no href or if href has dynamic :id params
    if (!node.href || node.href.includes(':')) return null;

    const IconComponent = resolveIcon(node.icon);
    const active = isActive(node.href);
    const content = (
      <Link
        to={node.href}
        className={cn(
          'gt-nav-link',
          mode === 'rail' ? 'justify-center' : '',
          collapsed && mode === 'rail' ? 'px-0' : ''
        )}
        data-active={active}
      >
        {IconComponent ? (
          <IconComponent
            className={cn('h-4 w-4 shrink-0', active ? 'text-ink' : 'text-ink-3')}
          />
        ) : (
          <div className="h-4 w-4 shrink-0" />
        )}
        {(!collapsed || mode === 'drawer') && (
          <span className="flex-1 truncate">{node.label}</span>
        )}
        {(!collapsed || mode === 'drawer') && node.shortcut && (
          <kbd className="hidden lg:inline-block text-[10px] font-mono text-ink-3 bg-(--surface-2) border border-(--line) rounded px-1.5 h-4.5 leading-4">
            {node.shortcut}
          </kbd>
        )}
      </Link>
    );


    if (collapsed && mode === 'rail') {
      return (
        <TooltipProvider key={node.key} delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              <p>{node.label}</p>
              {node.shortcut && (
                <p className="text-[10px] text-muted-foreground mt-0.5">⌘{node.shortcut}</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return <React.Fragment key={node.key}>{content}</React.Fragment>;
  };

  const userInitial = (user?.name?.[0] || 'U').toUpperCase();
  const fullName = user?.name || 'User';
  const roleLabel = user?.role || '—';

  const body = (
    <div className="h-full flex flex-col">
      {/* Brand */}
      <div className={cn(
        'h-16 flex items-center border-b border-(--line) shrink-0',
        collapsed ? 'justify-center px-1' : 'px-4 gap-2.5'
      )}>
        <a href="/dashboard" className="flex items-center group/logo">
          <Logo size="md" showText={!collapsed || mobileOpen} />
        </a>
        {mobileOpen && (
          <button
            onClick={onCloseMobile}
            className="ml-auto h-8 w-8 rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink flex items-center justify-center"
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
            <div className="h-7 w-7 rounded-md bg-surface-2 text-ink-2 flex items-center justify-center text-xs font-semibold shrink-0">
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
        {filteredTree.map((node) =>
          renderNode(node, mobileOpen ? 'drawer' : 'rail'),
        )}

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
      <div className={cn('border-t border-(--line) p-3 shrink-0', collapsed && !mobileOpen ? 'flex justify-center' : '')}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {collapsed && !mobileOpen ? (
              <button
                className="h-9 w-9 rounded-full bg-surface-2 text-ink-2 flex items-center justify-center text-xs font-semibold"
                aria-label="Account menu"
              >
                {userInitial}
              </button>
            ) : (
              <button className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-surface-2 transition-colors">
                <div className="h-8 w-8 rounded-full bg-iron text-iron-ink flex items-center justify-center text-xs font-semibold shrink-0">
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
          'hidden md:flex shrink-0 border-r border-(--line) bg-surface relative z-10',
          collapsed ? 'w-15' : 'w-56'
        )}
      >
        {body}
        <button
          onClick={onToggleCollapsed}
          className="absolute -right-3 top-16 h-6 w-6 rounded-full border border-(--line) bg-surface text-ink-3 hover:text-ink flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
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
              className="md:hidden fixed left-0 top-0 bottom-0 w-65 bg-surface z-50 border-r border-(--line)"
            >
              {body}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
