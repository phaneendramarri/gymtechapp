"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDirection } from '@/hooks/useDirection';
import {
  pageEnterForward,
  pageEnterBack,
  pageTransition,
} from '@/lib/motion';

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const direction = useDirection();

  const variants = direction === 'back' ? pageEnterBack : pageEnterForward;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={direction === 'none' ? 'initial' : undefined}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
