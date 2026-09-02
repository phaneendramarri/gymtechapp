import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Tag,
  CreditCard,
  ShieldAlert,
  BarChart3,
  Settings,
  Search,
  Trophy,
  Moon,
  Sun,
  LogOut,
  Plus,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onOpenChange }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const commands = useMemo(() => {
    const list = [
      { id: 'dashboard', label: 'Go to Operations Dashboard', icon: LayoutDashboard, category: 'Navigation', action: () => navigate('/dashboard') },
      { id: 'members', label: 'Go to Member Directory', icon: Users, category: 'Navigation', action: () => navigate('/members') },
      { id: 'new-member', label: 'Add New Member', icon: Plus, category: 'Actions', action: () => navigate('/members/new') },
      { id: 'attendance', label: 'Go to Attendance Desk', icon: CalendarCheck, category: 'Navigation', action: () => navigate('/attendance') },
      { id: 'payments', label: 'Go to Payments & Dues', icon: CreditCard, category: 'Navigation', action: () => navigate('/payments') },
      { id: 'pt', label: 'Go to PT Collections', icon: Trophy, category: 'Navigation', action: () => navigate('/pt-collections') },
      { id: 'plans', label: 'Go to Membership Plans', icon: Tag, category: 'Navigation', action: () => navigate('/plans') },
      { id: 'staff', label: 'Go to Staff & Trainers', icon: ShieldAlert, category: 'Navigation', action: () => navigate('/staff') },
      { id: 'reports', label: 'Go to Reports & Insights', icon: BarChart3, category: 'Navigation', action: () => navigate('/reports') },
      { id: 'settings', label: 'Go to Notification Settings', icon: Settings, category: 'Navigation', action: () => navigate('/settings/notifications') },
      { id: 'toggle-theme', label: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`, icon: theme === 'dark' ? Sun : Moon, category: 'Preferences', action: () => toggleTheme() },
      { id: 'logout', label: 'Sign Out of Account', icon: LogOut, category: 'Account', action: () => logout() },
    ];

    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((item) => item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q));
  }, [query, navigate, logout, theme, toggleTheme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const handleSelect = (action: () => void) => {
    action();
    onOpenChange(false);
    setQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-border bg-card shadow-2xl rounded-xl gap-0">
        <div className="flex items-center px-4 border-b border-border bg-secondary/30">
          <Search className="size-4 text-muted-foreground mr-2 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search pages (e.g. 'members', 'theme')..."
            className="w-full py-3.5 bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden font-sans"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded-sm border border-border text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="max-h-72 overflow-y-auto p-2 flex flex-col gap-1">
          {commands.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground font-mono">
              No matching commands found for "{query}"
            </div>
          ) : (
            commands.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() => handleSelect(cmd.action)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-secondary/80 transition-colors w-full text-left group"
                >
                  <div className="size-7 rounded-md bg-secondary flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                    <Icon className="size-3.5" />
                  </div>
                  <span className="flex-1 truncate">{cmd.label}</span>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-1.5 py-0.5 rounded-xs bg-secondary/50 border border-border/50">
                    {cmd.category}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
