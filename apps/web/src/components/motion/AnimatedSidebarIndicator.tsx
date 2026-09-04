/* =========================================================================
   AnimatedSidebarIndicator — the active pill glides between nav items.
   Replaces static active-state background changes.
   ========================================================================= */

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface AnimatedSidebarIndicatorProps {
  /** The DOM node of the currently active nav item */
  activeRef: React.RefObject<HTMLElement | null>;
  /** Whether the sidebar is collapsed */
  collapsed: boolean;
  className?: string;
}

export const AnimatedSidebarIndicator: React.FC<AnimatedSidebarIndicatorProps> = ({
  activeRef,
  collapsed,
  className,
}) => {
  const indicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeEl = activeRef.current;
    const indicator = indicatorRef.current;
    if (!activeEl || !indicator) return;

    const update = () => {
      const rect = activeEl.getBoundingClientRect();
      const parentRect = indicator.parentElement?.getBoundingClientRect();
      if (!parentRect) return;

      indicator.style.top = `${rect.top - parentRect.top + 4}px`;
      indicator.style.height = `${rect.height - 8}px`;
      indicator.style.left = collapsed ? '4px' : '8px';
      indicator.style.width = collapsed ? 'calc(100% - 8px)' : 'calc(100% - 16px)';
    };

    update();

    // Use ResizeObserver to track active item changes
    const ro = new ResizeObserver(update);
    ro.observe(activeEl);

    return () => ro.disconnect();
  }, [activeRef, collapsed]);

  return (
    <motion.div
      ref={indicatorRef}
      className={`absolute rounded-md bg-iron/10 ${className ?? ''}`}
      initial={false}
      layout
      transition={{
        duration: 0.18,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{ willChange: 'top, height, left, width' }}
    />
  );
};
