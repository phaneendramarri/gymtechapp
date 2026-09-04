/* =========================================================================
   PageTransition — spatial page transition with directional awareness.
   Wraps every route's content. Sidebar and header stay fixed.
   ========================================================================= */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDirection } from '@/hooks/useDirection';
import {
  pageEnterForward,
  pageEnterBack,
  pageTransition,
} from '@/lib/motion';

/** Wraps each route's content with directional spatial animation. */
export const PageTransition: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const direction = useDirection();

  const variants = direction === 'back' ? pageEnterBack : pageEnterForward;

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  );
};

/**
 * Page transition with explicit children key support.
 * Use when the child route has its own key (e.g., nested routes).
 */
export const KeyedPageTransition: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const direction = useDirection();
  const variants = direction === 'back' ? pageEnterBack : pageEnterForward;

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className={className}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  );
};

/**
 * AnimatePresence wrapper for the app — handles route exit animations.
 * Place once at the root of the router.
 */
export const MotionAnimatePresence = AnimatePresence;
