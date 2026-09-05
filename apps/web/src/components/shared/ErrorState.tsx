import React from 'react';
import { AlertCircle, RotateCcw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  backHref?: string;
  backLabel?: string;
  className?: string;
  compact?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  description = "We couldn't load this information. Please check your connection or try again.",
  onRetry,
  backHref,
  backLabel = "Go back",
  className,
  compact = false,
}) => {
  return (
    <Card className={cn("border-destructive/20 bg-destructive/5 text-foreground shadow-xs", className)}>
      <CardContent className={cn("flex flex-col items-center text-center", compact ? "p-6" : "p-8 sm:p-12")}>
        <div className="size-11 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-3.5 shrink-0">
          <AlertCircle className="size-5" />
        </div>
        <h3 className="font-semibold text-base text-foreground tracking-tight max-w-md">
          {title}
        </h3>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">
            {description}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {onRetry && (
            <Button
              variant="default"
              size="sm"
              onClick={onRetry}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <RotateCcw className="size-3.5" />
              <span>Try again</span>
            </Button>
          )}
          {backHref && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs border-border"
            >
              <Link to={backHref}>
                <ArrowLeft className="size-3.5" />
                <span>{backLabel}</span>
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
