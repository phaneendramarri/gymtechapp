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
  const trendColor = trend === 'up'
    ? 'text-emerald-600 dark:text-emerald-400'
    : trend === 'down'
    ? 'text-red-600 dark:text-red-400'
    : 'text-muted-foreground';

  return (
    <Card className={cn('relative overflow-hidden border-border/50 hover:border-border transition-colors group', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-3xl font-semibold tracking-tight text-foreground truncate">
                  {prefix && <span className="text-muted-foreground mr-0.5">{prefix}</span>}{value}
                </p>
              {delta && (
                <span className={cn('flex items-center gap-0.5 text-xs font-medium', trendColor)}>
                  <TrendIcon className="h-3 w-3" />
                  {delta}
                </span>
              )}
            </div>
            {sub && <p className="mt-1 text-sm text-muted-foreground truncate">{sub}</p>}
          </div>
          {Icon && (
            <div className="shrink-0 p-2.5 rounded-lg bg-muted/60 group-hover:bg-muted transition-colors">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>
        {description && (
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
        {/* Decorative gradient accent */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-50" />
      </CardContent>
    </Card>
  );
}
