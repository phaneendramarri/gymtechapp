import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { Button } from '@/components/ui/button';

export const ThemeToggle: React.FC<{ variant?: 'default' | 'outline' | 'ghost'; size?: 'sm' | 'default' | 'icon' }> = ({
  variant = 'ghost',
  size = 'icon',
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleTheme}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle theme"
      className="text-muted-foreground hover:text-foreground rounded-xs size-8 border border-border/80 bg-card/60 backdrop-blur-md transition-all duration-150"
    >
      {theme === 'dark' ? <Sun className="size-4 text-warn" /> : <Moon className="size-4 text-foreground" />}
    </Button>
  );
};
