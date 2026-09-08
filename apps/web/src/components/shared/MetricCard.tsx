"use client";

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  /** Optional prefix string shown before the value, e.g. "₹" */
  prefix?: string;
  /** Optional delta string, e.g. "+12%" or "-3%" */
  delta?: string;
  /** Raw numeric delta for trend direction */
  deltaValue?: number;
  /** Icon component */
  icon?: React.ComponentType<{ className?: string }>;
  /** Sub-text below the value */
  sub?: string;
  /** Description text */
  description?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  prefix,
  delta,
  deltaValue,
  icon: Icon,
  sub,
  description,
  className,
}: MetricCardProps) {
  const trend = deltaValue !== undefined
    ? deltaValue > 0 ? 'up' : deltaValue < 0 ? 'down' : 'neutral'
    : delta
    ? delta.startsWith('+') ? 'up' : delta.startsWith('-') ? 'down' : 'neutral'
    : 'neutral';

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <Card className={cn('group/card bg-card text-card-foreground ring-1 ring-border/70 hover:ring-border shadow-xs hover:shadow-md transition-all duration-200 rounded-xl overflow-hidden', className)}>
      <CardContent className="p-5 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono truncate">{label}</p>
          {Icon && (
            <div className="size-9 shrink-0 flex items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 group-hover:scale-105 transition-transform">
              <Icon className="size-4.5" />
            </div>
          )}
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2 flex-wrap">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono">
            {prefix && <span className="text-muted-foreground mr-0.5 text-xl sm:text-2xl font-normal">{prefix}</span>}
            {value}
          </div>
          {delta && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border',
                trend === 'up' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                trend === 'down' && 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
                trend === 'neutral' && 'bg-muted text-muted-foreground border-border'
              )}
            >
              <TrendIcon className="size-3" />
              {delta}
            </span>
          )}
        </div>

        {(sub || description) && (
          <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            {sub && <span className="truncate">{sub}</span>}
            {description && <span className="text-[11px] leading-tight text-muted-foreground">{description}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
