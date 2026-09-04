/* =========================================================================
   AnimatedPresence — controls presence animation (enter/exit) for any element.
   ========================================================================= */

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fadeVariants, fastTransition } from '@/lib/motion';

interface AnimatedPresenceProps {
  children: React.ReactNode;
  /** 'wait' = exit finishes before enter; 'popLayout' = layout animates smoothly */
  mode?: 'wait' | 'popLayout' | 'sync';
  /** Override the initial state (useful for SSR) */
  initial?: boolean;
}

export const AnimatedPresence: React.FC<AnimatedPresenceProps> = ({
  children,
  mode = 'wait',
  initial = true,
}) => {
  return (
    <AnimatePresence mode={mode} initial={initial}>
      {children}
    </AnimatePresence>
  );
};

/** Simple fade in/out wrapper for conditionally rendered content */
export const FadeIn: React.FC<{
  show: boolean;
  children: React.ReactNode;
  className?: string;
  /** 'wait' | 'sync' */
  mode?: 'wait' | 'sync';
}> = ({ show, children, className, mode = 'wait' }) => {
  return (
    <AnimatePresence mode={mode}>
      {show && (
        <motion.div
          variants={fadeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={fastTransition}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
