/* =========================================================================
   AnimatedDialog — modal with sequenced backdrop + rise choreography.
   ========================================================================= */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogPortal,
} from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { dialogVariants, dialogTransition } from '@/lib/motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnimatedDialogContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  /** 'sm' | 'md' | 'lg' | 'xl' — max-w */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export const AnimatedDialogContent: React.FC<AnimatedDialogContentProps> = ({
  open,
  onOpenChange,
  children,
  className,
  size = 'md',
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Backdrop */}
        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[3px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            />
          )}
        </AnimatePresence>

        {/* Dialog surface */}
        <DialogContent asChild>
          <motion.div
            className={cn(
              `fixed left-[50%] top-[50%] z-50 grid w-full ${sizeClasses[size]} translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-card p-6 shadow-xl rounded-xl`,
              className
            )}
            variants={dialogVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={dialogTransition}
          >
            {children}
            <DialogClose className="absolute right-4 top-4 rounded-md opacity-60 hover:opacity-100 transition-opacity duration-100 p-1 hover:bg-(--surface-2) text-(--ink-3)">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </motion.div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};

export {
  Dialog,
  DialogClose,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
