import React from 'react';
import { LogOut, Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const initials =
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative size-8 rounded-xs p-0 flex items-center justify-center bg-surface-2 border border-border/80 hover:border-primary/40 transition-all">
          <span className="font-mono text-xs font-bold text-foreground">{initials}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 rounded-sm border border-border/80 bg-card/95 backdrop-blur-xl shadow-xl p-1" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold leading-none text-foreground">{user?.name}</p>
            <p className="text-xs leading-none text-muted-foreground font-mono">{user?.email}</p>
            <div className="mt-1">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-xs text-[10px] font-mono font-medium bg-primary/10 text-primary border border-primary/20">
                {user?.role}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user?.role === 'PLATFORM_ADMIN' && (
          <DropdownMenuItem asChild className="rounded-xs cursor-pointer">
            <a href="/admin" className="flex items-center gap-2">
              <Shield className="size-4 text-muted-foreground" />
              <span>Platform Admin</span>
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={logout} className="rounded-xs text-destructive focus:text-destructive cursor-pointer">
          <LogOut className="mr-2 size-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
