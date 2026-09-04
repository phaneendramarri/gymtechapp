/* =========================================================================
   SidebarIndicator — animated pill that glides to the active nav item.
   Uses ResizeObserver to track the active element's position.
   ========================================================================= */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface SidebarIndicatorProps {
  collapsed: boolean;
}

export const SidebarIndicator: React.FC<SidebarIndicatorProps> = ({ collapsed }) => {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const [activeRect, setActiveRect] = useState<DOMRect | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Find the nav element and active link
    const findActive = () => {
      const nav = document.querySelector('[data-sidebar-nav="true"]');
      const activeLink = nav?.querySelector<HTMLElement>('[data-active="true"]');

      if (activeLink && indicatorRef.current) {
        const navRect = nav?.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();
        if (navRect) {
          setActiveRect({
            top: linkRect.top - navRect.top,
            height: linkRect.height,
            left: collapsed ? 4 : 8,
            width: (navRect.width - (collapsed ? 16 : 32)),
          } as DOMRect);
        }
      }
    };

    // Initial find
    findActive();

    // Poll for active link changes (MutationObserver on data-active attribute)
    const nav = document.querySelector('[data-sidebar-nav="true"]');
    if (!nav) return;

    const observer = new MutationObserver(findActive);
    observer.observe(nav, { attributes: true, attributeFilter: ['data-active'], subtree: true });

    // Also observe ResizeObserver on the nav for size changes
    const ro = new ResizeObserver(findActive);
    ro.observe(nav);

    return () => {
      observer.disconnect();
      ro.disconnect();
    };
  }, [collapsed]);

  if (!activeRect) return null;

  return (
    <motion.div
      ref={indicatorRef}
      className="absolute rounded-md bg-iron/10 pointer-events-none"
      animate={{
        top: activeRect.top + 4,
        height: activeRect.height - 8,
        left: activeRect.left,
        width: activeRect.width,
        opacity: 1,
      }}
      initial={{ opacity: 0 }}
      transition={{
        duration: 0.18,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{ willChange: 'top, height, left, width' }}
    />
  );
};
