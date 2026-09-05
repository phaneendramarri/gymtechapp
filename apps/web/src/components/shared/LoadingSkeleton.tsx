import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 5,
  className,
}) => {
  return (
    <div className={cn("w-full space-y-3", className)}>
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-border/60">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24 rounded-sm" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center justify-between gap-4 py-3 border-b border-border/40">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn("h-4 rounded-sm", c === 0 ? "w-36" : c === columns - 1 ? "w-16" : "w-24")}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export interface CardGridSkeletonProps {
  count?: number;
  cols?: 2 | 3 | 4;
  className?: string;
}

export const CardGridSkeleton: React.FC<CardGridSkeletonProps> = ({
  count = 4,
  cols = 4,
  className,
}) => {
  const colClass =
    cols === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : cols === 3
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={cn("grid gap-4", colClass, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-border shadow-2xs">
          <CardHeader className="p-4 pb-2 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20 rounded-sm" />
              <Skeleton className="size-6 rounded-md" />
            </div>
            <Skeleton className="h-7 w-28 rounded-sm" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <Skeleton className="h-3 w-36 rounded-sm" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export const DetailSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-start gap-4 p-6 rounded-xl border border-border bg-card">
        <Skeleton className="size-16 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-6 w-48 rounded-sm" />
          <Skeleton className="h-3.5 w-64 rounded-sm" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      </div>
      <Card className="border-border">
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-8 w-64 rounded-sm" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
