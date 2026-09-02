import React from 'react';
import { Card } from './card';
import { cn } from '@/lib/utils';
import { AnimatedCounter } from '@/components/shared/AnimatedCounter';
import { Sparkline, DeltaPill } from '@/components/shared/Sparkline';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'accent' | 'ok' | 'err';
  prefix?: string;
  /** Optional sparkline series (oldest first). */
  sparkline?: number[]
  /** Optional period-over-period delta in % (e.g. 12 = +12%). */
  delta?: number
}

const variantStyles: Record<NonNullable<StatCardProps['variant']>, { chip: string; ring: string }> = {
  default: { chip: 'bg-secondary text-foreground', ring: '' },
  accent: { chip: 'bg-primary/10 text-primary', ring: 'ring-1 ring-primary/20' },
  ok: { chip: 'bg-ok/10 text-ok', ring: 'ring-1 ring-ok/20' },
  err: { chip: 'bg-destructive/10 text-destructive', ring: 'ring-1 ring-destructive/20' },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'default',
  prefix,
  sparkline,
  delta,
}) => {
  const styles = variantStyles[variant];

  return (
    <Card className={cn('card-hover-lift p-4 sm:p-5 border-border bg-card shadow-xs transition-all', styles.ring)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-mono">
          {title}
        </p>
        {icon && (
          <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg shadow-2xs', styles.chip)}>
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl num-tabular">
          {typeof value === 'number' ? (
            <AnimatedCounter value={value} prefix={prefix} />
          ) : (
            value
          )}
        </div>
        {delta !== undefined && <DeltaPill delta={delta} />}
      </div>
      {(subtitle || sparkline) && (
        <div className="mt-2 flex items-end justify-between gap-2">
          {subtitle ? (
            <p className="text-xs text-muted-foreground truncate flex-1">{subtitle}</p>
          ) : <span />}
          {sparkline && sparkline.length > 1 && (
            <Sparkline
              data={sparkline}
              width={84}
              height={22}
              className="shrink-0"
            />
          )}
        </div>
      )}
    </Card>
  );
};
