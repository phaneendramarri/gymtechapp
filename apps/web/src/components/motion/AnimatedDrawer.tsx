/* =========================================================================
   AnimatedDrawer — panel slides from right, background stays fixed.
   ========================================================================= */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  drawerVariants,
  drawerOverlayVariants,
  drawerTransition,
} from '@/lib/motion';

interface AnimatedDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** 'sm' | 'md' | 'lg' | 'full' */
  width?: 'sm' | 'md' | 'lg' | 'full';
  title?: string;
  className?: string;
}

const widthClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  full: 'max-w-full',
};

export const AnimatedDrawer: React.FC<AnimatedDrawerProps> = ({
  open,
  onClose,
  children,
  width = 'md',
  title,
  className,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            variants={drawerOverlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <motion.div
            className={cn(
              `fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-line bg-card shadow-xl`,
              widthClasses[width],
              className
            )}
            variants={drawerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={drawerTransition}
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="text-h3">{title}</h2>
              <button
                onClick={onClose}
                className="rounded-md p-1 opacity-60 hover:opacity-100 hover:bg-(--surface-2) transition-opacity duration-100"
                aria-label="Close drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
