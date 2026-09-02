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

/** Colored left-border accent per variant, plus icon chip + ring. */
const variantStyles: Record<NonNullable<StatCardProps['variant']>, { border: string; chip: string; ring: string }> = {
  default: { border: 'border-l-2 border-l-(--ink-3)', chip: 'bg-(--surface-2) text-(--ink-2)', ring: '' },
  accent:  { border: 'border-l-2 border-l-(--iron)',    chip: 'bg-(--iron-soft) text-(--iron)',       ring: 'ring-1 ring-(--iron)/10' },
  ok:       { border: 'border-l-2 border-l-(--positive)', chip: 'bg-(--positive-soft) text-(--positive)', ring: 'ring-1 ring-(--positive)/10' },
  err:      { border: 'border-l-2 border-l-(--danger)',   chip: 'bg-(--danger-soft) text-(--danger)',   ring: 'ring-1 ring-(--danger)/10' },
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
  const { border, chip, ring } = variantStyles[variant];

  return (
    <Card className={cn('card-hover-lift p-4 sm:p-5 border-border bg-card shadow-xs transition-all pl-4', border, ring)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-meta font-semibold uppercase tracking-wider text-(--ink-3) font-mono">
          {title}
        </p>
        {icon && (
          <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg shadow-2xs', chip)}>
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="font-display text-2xl font-bold tracking-tight text-(--ink) sm:text-3xl num-tabular">
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
            <p className="text-xs text-(--ink-3) truncate flex-1">{subtitle}</p>
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
