/* =========================================================================
   AnimatedList — list items animate in/out with layout motion.
   ========================================================================= */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  listItemVariants,
  listStaggerContainer,
  highlightVariants,
  fastTransition,
} from '@/lib/motion';

/** Container that staggers children on enter */
export const AnimatedListContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <motion.div
    variants={listStaggerContainer}
    initial="initial"
    animate="animate"
    className={className}
  >
    {children}
  </motion.div>
);

/** Individual list item — handles enter/exit with layout animation */
export const AnimatedListItem: React.FC<{
  children: React.ReactNode;
  /** Unique key — required for AnimatePresence to track correctly */
  id: string | number;
  className?: string;
  /** 'default' | 'highlight' — brief iron flash on enter */
  animation?: 'default' | 'highlight';
}> = ({ children, id, className, animation = 'default' }) => {
  const variants = animation === 'highlight' ? highlightVariants : listItemVariants;

  return (
    <motion.div
      layout
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={fastTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/** Wrap AnimatePresence around a list for proper exit animations */
export const AnimatedList: React.FC<{
  children: React.ReactNode;
  mode?: 'wait' | 'sync' | 'popLayout';
}> = ({ children, mode = 'popLayout' }) => (
  <AnimatePresence mode={mode} initial={false}>
    {children}
  </AnimatePresence>
);
