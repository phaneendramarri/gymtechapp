import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-20 w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm text-(--fg) placeholder:text-(--ink-3) focus:outline-none focus:ring-2 focus:ring-(--accent) focus:ring-offset-1 focus:ring-offset-(--bg) disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
