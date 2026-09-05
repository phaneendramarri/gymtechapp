"use client";

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  User,
  Shield,
  Building2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/lib/theme';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/shared/Logo';

interface AppHeaderProps {
  gymName: string;
  onOpenMobileMenu: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ gymName, onOpenMobileMenu }) => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Track scroll for glassmorphism intensify
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

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

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '·';

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-30 h-14 sm:h-16 border-b transition-all duration-300',
          scrolled
            ? 'bg-background/85 backdrop-blur-xl border-border/80 shadow-xs'
            : 'bg-background/60 backdrop-blur-md border-border/40'
        )}
      >
        <div className="h-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex items-center justify-between gap-3">

          {/* Left: Hamburger (mobile) + Gym Identity */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenMobileMenu}
              className="md:hidden h-9 w-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center justify-center shrink-0 transition-colors"
              aria-label="Open navigation drawer"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2.5 text-left group"
            >
              <Logo size="sm" className="hidden sm:block" />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground leading-tight tracking-tight max-w-[140px] sm:max-w-xs truncate">
                    {gymName}
                  </span>
                  <Badge variant="outline" className="hidden xl:inline-flex text-[10px] font-mono py-0 px-1.5 border-border bg-secondary/50">
                    Live
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono leading-none hidden sm:inline">
                  GymTech Cloud
                </span>
              </div>
            </button>
          </div>

          {/* Center: Command Palette Trigger Input */}
          <div className="flex-1 max-w-md mx-2 sm:mx-6 hidden md:block">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="w-full h-9 px-3 text-xs text-muted-foreground bg-secondary/60 hover:bg-secondary/90 hover:text-foreground border border-border/70 rounded-lg flex items-center justify-between transition-colors shadow-2xs group"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span>Search members, payments, plans...</span>
              </span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>
          </div>

          {/* Right: Quick actions, Theme, User profile */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Mobile Search Icon */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCommandOpen(true)}
              className="md:hidden h-9 w-9 text-muted-foreground hover:text-foreground"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
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
                className="hidden sm:inline-flex gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New member</span>
              </Button>
            )}

            {/* User Dropdown */}
            {user && (
              <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'flex items-center gap-2 h-9 pl-1 pr-2.5 rounded-lg transition-colors',
                      'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      userMenuOpen ? 'bg-accent' : ''
                    )}
                  >
                    <div className="h-7 w-7 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
                      {loggingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : initials}
                    </div>
                    <div className="hidden lg:flex flex-col items-start min-w-0">
                      <span className="text-xs font-medium text-foreground leading-tight max-w-28 truncate">
                        {user.name || 'User'}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-none capitalize">
                        {user.role?.toLowerCase().replace('_', ' ') || 'Staff'}
                      </span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" sideOffset={8} className="w-56 p-1.5 shadow-lg border-border">
                  <DropdownMenuLabel className="font-normal p-2">
                    <div className="flex flex-col space-y-1">
                      <p className="text-xs font-semibold leading-none text-foreground">{user.name}</p>
                      <p className="text-[11px] leading-none text-muted-foreground font-mono truncate">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => { setUserMenuOpen(false); navigate('/settings/notifications'); }}
                    className="cursor-pointer text-xs"
                  >
                    <Settings className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span>Settings & Notifications</span>
                  </DropdownMenuItem>

                  {(user.role === 'OWNER' || user.role === 'PLATFORM_ADMIN') && (
                    <DropdownMenuItem
                      onClick={() => { setUserMenuOpen(false); navigate('/admin'); }}
                      className="cursor-pointer text-xs"
                    >
                      <Shield className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      <span>Admin Management</span>
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
        </div>
      </header>

      {/* Global Command Palette (⌘K) */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Type a command or search section..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
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

          <CommandGroup heading="Quick Actions">
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
              <span>Notification Quotas & Settings</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};
