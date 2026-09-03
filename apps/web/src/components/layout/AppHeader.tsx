import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Menu, Bell, Sun, Moon, Plus, Command } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Tag,
  CreditCard,
  Trophy,
  BarChart3,
  Settings,
  UserCog,
  Receipt,
  UserPlus,
  ArrowDownToLine,
  Send,
} from 'lucide-react';

interface AppHeaderProps {
  gymName: string;
  onOpenMobileMenu: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'Navigate' | 'Action';
  shortcut?: string;
  onSelect: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ gymName, onOpenMobileMenu }) => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');

  // ⌘K / Ctrl+K to open palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [paletteOpen]);

  const items: CommandItem[] = useMemo(
    () => [
      { id: 'g:dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Navigate', shortcut: '1', onSelect: () => navigate('/dashboard') },
      { id: 'g:members', label: 'Members', icon: Users, group: 'Navigate', shortcut: '2', onSelect: () => navigate('/members') },
      { id: 'g:floor', label: 'Floor / Attendance', icon: CalendarCheck, group: 'Navigate', shortcut: '3', onSelect: () => navigate('/attendance') },
      { id: 'g:payments', label: 'Payments', icon: CreditCard, group: 'Navigate', shortcut: '5', onSelect: () => navigate('/payments') },
      { id: 'g:pt', label: 'PT Collections', icon: Trophy, group: 'Navigate', onSelect: () => navigate('/pt-collections') },
      { id: 'g:plans', label: 'Plans', icon: Tag, group: 'Navigate', onSelect: () => navigate('/plans') },
      { id: 'g:staff', label: 'Staff', icon: UserCog, group: 'Navigate', onSelect: () => navigate('/staff') },
      { id: 'g:reports', label: 'Reports', icon: BarChart3, group: 'Navigate', shortcut: '6', onSelect: () => navigate('/reports') },
      { id: 'g:settings', label: 'Settings', icon: Settings, group: 'Navigate', onSelect: () => navigate('/settings/notifications') },
      { id: 'a:new-member', label: 'Add a new member', hint: 'Open registration', icon: UserPlus, group: 'Action', onSelect: () => navigate('/members/new') },
      { id: 'a:record-payment', label: 'Record a payment', icon: Receipt, group: 'Action', onSelect: () => navigate('/payments') },
      { id: 'a:export', label: 'Export current view', icon: ArrowDownToLine, group: 'Action', onSelect: () => window.print() },
      { id: 'a:whatsapp-blast', label: 'Send WhatsApp reminder…', icon: Send, group: 'Action', onSelect: () => navigate('/members') },
    ],
    [navigate]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)
    );
  }, [query, items]);

  const [highlight, setHighlight] = useState(0);
  useEffect(() => {
    setHighlight(0);
  }, [query, paletteOpen]);

  const runItem = (i: CommandItem) => {
    setPaletteOpen(false);
    setQuery('');
    i.onSelect();
  };

  return (
    <>
      <header className="h-14 border-b border-(--line) bg-(--surface) flex items-center px-4 md:px-6 gap-2 shrink-0">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden h-8 w-8 rounded-md text-ink-2 hover:bg-(--surface-2) flex items-center justify-center"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Gym badge (mobile only — desktop shows it in the rail) */}
        <div className="md:hidden flex items-center gap-2 ml-1">
          <div className="h-6 w-6 rounded bg-iron text-iron-ink flex items-center justify-center text-[10px] font-semibold">
            {gymName?.[0] || 'G'}
          </div>
          <span className="text-xs font-semibold text-ink truncate max-w-40">{gymName}</span>
        </div>

        {/* Global search trigger */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="ml-auto md:ml-0 inline-flex items-center gap-2 h-9 px-3 rounded-md bg-(--surface-2) hover:bg-(--surface-2)/80 text-ink-3 text-xs border border-transparent hover:border-(--line) transition-colors md:w-72"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Search…</span>
          <span className="md:hidden">Search</span>
          <kbd className="hidden md:inline-block ml-auto text-[10px] font-mono bg-surface border border-(--line) rounded px-1.5 h-4.5 leading-4 text-ink-3">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto md:ml-0 flex items-center gap-1">
          <button
            onClick={() => setPaletteOpen(true)}
            className="md:hidden h-9 w-9 rounded-md text-ink-3 hover:bg-(--surface-2) flex items-center justify-center"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-9 w-9 rounded-md text-ink-3 hover:bg-(--surface-2) hover:text-ink-2 flex items-center justify-center"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            className="hidden sm:inline-flex h-9 w-9 rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink-2 items-center justify-center relative"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-(--iron) ring-2 ring-(--surface)" />
          </button>

          {user && user.role !== 'MEMBER' && (
            <button
              onClick={() => navigate('/members/new')}
              className="hidden sm:inline-flex gt-btn gt-btn-primary h-9 px-3 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          )}
        </div>
      </header>

      {/* Command palette */}
      <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <DialogContent className="p-0 gap-0 max-w-140 w-[calc(100vw-32px)] top-[15vh] translate-y-0 bg-(--surface) border-(--line) shadow-lg">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <div className="flex items-center gap-2 px-4 h-12 border-b border-(--line)">
            <Search className="h-4 w-4 text-(--ink-3)" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlight((h) => Math.min(h + 1, filtered.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlight((h) => Math.max(h - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filtered[highlight]) runItem(filtered[highlight]);
                }
              }}
              placeholder="Type a command or search…"
              className="flex-1 bg-transparent border-0 outline-none text-sm text-(--ink) placeholder:text-(--ink-3)"
            />
            <kbd className="text-[10px] font-mono text-(--ink-3) bg-(--surface-2) border border-(--line) rounded px-1.5 h-4.5 leading-4 flex items-center gap-1">
              <span>ESC</span>
            </kbd>
          </div>

          <div className="max-h-[60vh] overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-(--ink-3)">
                No results for <span className="font-mono text-ink-2">"{query}"</span>
              </div>
            ) : (
              ['Navigate', 'Action'].map((group) => {
                const groupItems = filtered.filter((i) => i.group === group);
                if (groupItems.length === 0) return null;
                return (
                  <div key={group} className="px-2 pb-2">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-(--ink-3) font-semibold">
                      {group}
                    </div>
                    {groupItems.map((item) => {
                      const idx = filtered.indexOf(item);
                      return (
                        <button
                          key={item.id}
                          onClick={() => runItem(item)}
                          onMouseEnter={() => setHighlight(idx)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 h-10 rounded-lg text-sm text-(--ink) text-left transition-colors',
                            idx === highlight
                              ? 'bg-iron-soft text-iron'
                              : 'hover:bg-(--surface-2)'
                          )}
                        >
                          <item.icon className={cn('h-4 w-4 shrink-0', idx === highlight ? 'text-(--iron)' : 'text-(--ink-3)')} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.hint && (
                            <span className="text-[11px] text-(--ink-3)">{item.hint}</span>
                          )}
                          {item.shortcut && (
                            <kbd className="text-[10px] font-mono text-(--ink-3) bg-(--surface-2) border border-(--line) rounded px-1.5 h-4.5 leading-4">
                              ⌘{item.shortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-(--line) px-4 py-2.5 flex items-center justify-between text-[10px] text-(--ink-3)">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="font-mono bg-(--surface-2) border border-(--line) rounded px-1 h-4 leading-3.5">↑</kbd>
                <kbd className="font-mono bg-(--surface-2) border border-(--line) rounded px-1 h-4 leading-3.5">↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="font-mono bg-(--surface-2) border border-(--line) rounded px-1 h-4 leading-3.5">↵</kbd>
                open
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Command className="h-3 w-3" /> GymTech OS
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
