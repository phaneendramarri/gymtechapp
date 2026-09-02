import React from 'react';
import { Badge } from '@/components/ui/badge';

export type StatusVariant =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'FROZEN'
  | 'PAID'
  | 'PENDING'
  | 'FAILED'
  | 'OWNER'
  | 'MANAGER'
  | 'STAFF'
  | 'TRAINER'
  | 'PLATFORM_ADMIN';

interface StatusBadgeProps {
  status: string;
  variant?: 'member' | 'payment' | 'role';
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  label,
  size = 'md',
  className = '',
}) => {
  const norm = (status || '').toUpperCase();
  const displayLabel = label || status;
  const isSmall = size === 'sm';

  const sizeClasses = isSmall
    ? 'text-[10px] px-2 py-0.5 font-mono gap-1'
    : 'text-xs px-2.5 py-1 font-mono gap-1.5';

  if (variant === 'role' || norm === 'OWNER' || norm === 'MANAGER' || norm === 'TRAINER' || norm === 'STAFF' || norm === 'PLATFORM_ADMIN') {
    if (norm === 'OWNER' || norm === 'PLATFORM_ADMIN') {
      return (
        <Badge
          variant="outline"
          className={`border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold rounded-full ${sizeClasses} ${className}`}
        >
          <span className="size-1.5 rounded-full bg-purple-500" />
          <span>{label || (norm === 'OWNER' ? 'Gym Owner' : 'Super Admin')}</span>
        </Badge>
      );
    }
    if (norm === 'MANAGER') {
      return (
        <Badge
          variant="outline"
          className={`border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold rounded-full ${sizeClasses} ${className}`}
        >
          <span className="size-1.5 rounded-full bg-blue-500" />
          <span>{label || 'Manager'}</span>
        </Badge>
      );
    }
    if (norm === 'TRAINER') {
      return (
        <Badge
          variant="outline"
          className={`border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold rounded-full ${sizeClasses} ${className}`}
        >
          <span className="size-1.5 rounded-full bg-amber-500" />
          <span>{label || 'Trainer'}</span>
        </Badge>
      );
    }
    return (
      <Badge
        variant="secondary"
        className={`font-mono text-muted-foreground rounded-full ${sizeClasses} ${className}`}
      >
        <span>{label || 'Front Desk'}</span>
      </Badge>
    );
  }

  if (variant === 'payment' || norm === 'PAID' || norm === 'SUCCESS' || norm === 'PENDING' || norm === 'DUE') {
    if (norm === 'PAID' || norm === 'SUCCESS') {
      return (
        <Badge
          variant="outline"
          className={`border-primary/30 bg-primary/10 text-primary font-bold rounded-full ${sizeClasses} ${className}`}
        >
          <span className="size-1.5 rounded-full bg-primary" />
          <span>{label || 'Paid'}</span>
        </Badge>
      );
    }
    if (norm === 'PENDING' || norm === 'DUE') {
      return (
        <Badge
          variant="outline"
          className={`border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold rounded-full ${sizeClasses} ${className}`}
        >
          <span className="size-1.5 rounded-full bg-amber-500" />
          <span>{label || 'Pending'}</span>
        </Badge>
      );
    }
  }

  // Default: Member status
  if (norm === 'ACTIVE') {
    return (
      <Badge
        variant="outline"
        className={`border-ok/30 bg-ok/10 text-ok font-bold rounded-full ${sizeClasses} ${className}`}
      >
        <span className="relative flex size-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ok opacity-75"></span>
          <span className="relative inline-flex rounded-full size-1.5 bg-ok"></span>
        </span>
        <span>{displayLabel}</span>
      </Badge>
    );
  }

  if (norm === 'EXPIRED') {
    return (
      <Badge
        variant="outline"
        className={`border-destructive/30 bg-destructive/10 text-destructive font-semibold rounded-full ${sizeClasses} ${className}`}
      >
        <span className="size-1.5 rounded-full bg-destructive" />
        <span>{displayLabel}</span>
      </Badge>
    );
  }

  if (norm === 'FROZEN') {
    return (
      <Badge
        variant="outline"
        className={`border-blue-500/30 bg-blue-500/10 text-blue-500 font-semibold rounded-full ${sizeClasses} ${className}`}
      >
        <span className="size-1.5 rounded-full bg-blue-500" />
        <span>{displayLabel}</span>
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={`font-mono text-muted-foreground rounded-full ${sizeClasses} ${className}`}
    >
      <span>{displayLabel}</span>
    </Badge>
  );
};
