"use client";

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Search,
  Menu,
  Sun,
  Moon,
  Plus,
  LayoutDashboard,
  Users,
  CalendarCheck,
  Tag,
  CreditCard,
  Trophy,
  BarChart3,
  Settings,
  UserCog,
  LogOut,
  ChevronDown,
  Loader2,
  Shield,
  Sliders,
  Building2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';

export interface BreadcrumbCrumb {
  label: string;
  href?: string;
}

interface AppHeaderProps {
  gymName?: string;
  breadcrumbs?: BreadcrumbCrumb[];
  onOpenMobileMenu: () => void;
}

// Route mapping for automatic breadcrumb context
const ROUTE_LABELS: Record<string, { parent?: { label: string; href: string }; label: string }> = {
  '/dashboard': { label: 'Dashboard' },
  '/members': { label: 'Members' },
  '/members/new': { parent: { label: 'Members', href: '/members' }, label: 'New Member' },
  '/attendance': { label: 'Live Floor' },
  '/payments': { label: 'Payments' },
  '/pt-collections': { label: 'PT Sessions' },
  '/plans': { label: 'Membership Plans' },
  '/staff': { label: 'Staff Management' },
  '/reports': { label: 'Reports & Analytics' },
  '/settings/notifications': { parent: { label: 'Settings', href: '/settings/notifications' }, label: 'Notifications' },
  '/audit-logs': { label: 'Audit Logs' },
  '/communications': { label: 'Communications' },
  '/admin': { parent: { label: 'Platform', href: '/admin' }, label: 'Gyms & Tenants' },
  '/platform/users': { parent: { label: 'Platform', href: '/admin' }, label: 'Platform Users' },
  '/platform/roles': { parent: { label: 'Platform', href: '/admin' }, label: 'Roles & Governance' },
  '/platform/menus': { parent: { label: 'Platform', href: '/admin' }, label: 'Menu Management' },
};

export const AppHeader: React.FC<AppHeaderProps> = ({
  breadcrumbs,
  onOpenMobileMenu,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [commandOpen, setCommandOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  const handleNavigate = (path: string) => {
    setCommandOpen(false);
    navigate(path);
  };

  // Derive breadcrumbs if not explicitly passed
  const activeRouteInfo = ROUTE_LABELS[location.pathname];
  const derivedCrumbs: BreadcrumbCrumb[] = breadcrumbs || (
    activeRouteInfo?.parent
      ? [
          { label: 'Gym Console', href: '/dashboard' },
          { label: activeRouteInfo.parent.label, href: activeRouteInfo.parent.href },
          { label: activeRouteInfo.label },
        ]
      : activeRouteInfo
        ? [
            { label: 'Gym Console', href: '/dashboard' },
            { label: activeRouteInfo.label },
          ]
        : [{ label: 'Gym Console', href: '/dashboard' }]
  );

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '·';

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 sm:h-16 shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md transition-all sm:px-6 lg:px-8">
        {/* Left: Mobile Toggle + Separator + Dynamic Breadcrumb Trail */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden h-8 w-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground flex items-center justify-center shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Open navigation menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          <Separator orientation="vertical" className="h-4 md:hidden" />

          {/* Breadcrumb Context */}
          <Breadcrumb className="hidden sm:block truncate">
            <BreadcrumbList className="text-xs">
              {derivedCrumbs.map((c, i) => {
                const isLast = i === derivedCrumbs.length - 1;
                return (
                  <React.Fragment key={i}>
                    <BreadcrumbItem>
                      {c.href && !isLast ? (
                        <BreadcrumbLink asChild>
                          <Link to={c.href} className="text-muted-foreground hover:text-foreground transition-colors">
                            {c.label}
                          </Link>
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage className="font-semibold text-foreground">
                          {c.label}
                        </BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </React.Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Center: Command Palette Trigger Input */}
        <div className="flex-1 max-w-sm mx-2 hidden md:block">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="w-full h-8 px-2.5 text-xs text-muted-foreground bg-secondary/50 hover:bg-secondary hover:text-foreground border border-border/60 rounded-lg flex items-center justify-between transition-colors shadow-2xs group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              <span className="truncate">Search members, actions, records...</span>
            </span>
            <kbd className="pointer-events-none inline-flex h-4.5 select-none items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground shrink-0">
              <span className="text-[10px]">⌘</span>K
            </kbd>
          </button>
        </div>

        {/* Right: Quick actions, Theme, User profile */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile Search Icon Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCommandOpen(true)}
            className="md:hidden h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
          >
            <AnimatePresence mode="wait" initial={false}>
              {theme === 'dark' ? (
                <motion.div
                  key="sun"
                  initial={{ opacity: 0, rotate: -45, scale: 0.8 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 45, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  <Sun className="h-4 w-4" />
                </motion.div>
              ) : (
                <motion.div
                  key="moon"
                  initial={{ opacity: 0, rotate: 45, scale: 0.8 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: -45, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  <Moon className="h-4 w-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </Button>

          {/* Quick action: Add Member */}
          {user && user.role !== 'MEMBER' && (
            <Button
              size="sm"
              onClick={() => navigate('/members/new')}
              className="hidden lg:inline-flex gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New member</span>
            </Button>
          )}

          {/* User Dropdown */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-2 h-8 pl-1 pr-2 rounded-lg transition-colors border border-border/50 bg-secondary/30',
                    'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                >
                  <div className="h-6 w-6 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-[11px] font-bold shrink-0">
                    {loggingOut ? <Loader2 className="h-3 w-3 animate-spin" /> : initials}
                  </div>
                  <div className="hidden xl:flex flex-col items-start min-w-0">
                    <span className="text-xs font-medium text-foreground leading-tight max-w-[100px] truncate">
                      {user.name || 'User'}
                    </span>
                  </div>
                  <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" sideOffset={6} className="w-56 p-1.5 shadow-lg border-border">
                <DropdownMenuLabel className="font-normal p-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs font-semibold leading-none text-foreground">{user.name}</p>
                    <p className="text-[11px] leading-none text-muted-foreground font-mono truncate">{user.email}</p>
                    <span className="text-[10px] text-primary font-medium capitalize mt-0.5">
                      {user.role?.toLowerCase().replace('_', ' ') || 'Staff'}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => navigate('/settings/notifications')}
                  className="cursor-pointer text-xs"
                >
                  <Settings className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  <span>Settings & Preferences</span>
                </DropdownMenuItem>

                {(user.role === 'OWNER' || user.role === 'PLATFORM_ADMIN') && (
                  <DropdownMenuItem
                    onClick={() => navigate('/admin')}
                    className="cursor-pointer text-xs"
                  >
                    <Shield className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span>Platform Admin</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="cursor-pointer text-xs text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Global Command Palette (⌘K) */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Type a command or search section..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Operations">
            <CommandItem onSelect={() => handleNavigate('/dashboard')}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Dashboard Overview</span>
            </CommandItem>
            <CommandItem onSelect={() => handleNavigate('/members')}>
              <Users className="mr-2 h-4 w-4" />
              <span>Members Directory</span>
            </CommandItem>
            <CommandItem onSelect={() => handleNavigate('/attendance')}>
              <CalendarCheck className="mr-2 h-4 w-4" />
              <span>Live Attendance & Floor</span>
            </CommandItem>
            <CommandItem onSelect={() => handleNavigate('/payments')}>
              <CreditCard className="mr-2 h-4 w-4" />
              <span>Payments & Ledger</span>
            </CommandItem>
            <CommandItem onSelect={() => handleNavigate('/pt-collections')}>
              <Trophy className="mr-2 h-4 w-4" />
              <span>Personal Training Collections</span>
            </CommandItem>
            <CommandItem onSelect={() => handleNavigate('/plans')}>
              <Tag className="mr-2 h-4 w-4" />
              <span>Membership Plans</span>
            </CommandItem>
            <CommandItem onSelect={() => handleNavigate('/reports')}>
              <BarChart3 className="mr-2 h-4 w-4" />
              <span>Reports & Analytics</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Management & Platform">
            <CommandItem onSelect={() => handleNavigate('/members/new')}>
              <Plus className="mr-2 h-4 w-4 text-primary" />
              <span>Add New Member</span>
            </CommandItem>
            <CommandItem onSelect={() => handleNavigate('/staff')}>
              <UserCog className="mr-2 h-4 w-4" />
              <span>Manage Staff Team</span>
            </CommandItem>
            <CommandItem onSelect={() => handleNavigate('/settings/notifications')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings & Notifications</span>
            </CommandItem>
            <CommandItem onSelect={() => handleNavigate('/audit-logs')}>
              <Sliders className="mr-2 h-4 w-4" />
              <span>Audit Logs</span>
            </CommandItem>
            {(user?.role === 'PLATFORM_ADMIN' || user?.role === 'OWNER') && (
              <CommandItem onSelect={() => handleNavigate('/admin')}>
                <Building2 className="mr-2 h-4 w-4 text-primary" />
                <span>Gyms & Platform Management</span>
              </CommandItem>
            )}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};

