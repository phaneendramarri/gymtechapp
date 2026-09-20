import React from 'react';
import { Logo } from '@/components/shared/Logo';
import { cn } from '@/lib/utils';

/**
 * Branded full-screen transition state — used for route chunk loads,
 * session checks, and auth redirects so the user never sees a blank page.
 * Keep it fast and quiet: logo, one-line message, indeterminate bar.
 */
export const RouteSplash: React.FC<{ message?: string; className?: string }> = ({
  message = 'Loading…',
  className,
}) => (
  <div
    className={cn(
      'flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-background',
      className
    )}
    role="status"
    aria-label={message}
  >
    <Logo size="md" />
    <div className="h-1 w-36 overflow-hidden rounded-full bg-muted">
      <div className="h-full w-2/5 rounded-full bg-primary gt-splash-slide" />
    </div>
    <p className="text-xs font-medium text-muted-foreground">{message}</p>
  </div>
);
