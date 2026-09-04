/* =========================================================================
   AnimatedTabs — tabs with gliding active indicator.
   ========================================================================= */

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

/* ---------------------------------------------------------------------------
   AnimatedTabsList — a tabs list with a gliding iron underline indicator.
   --------------------------------------------------------------------------- */

interface AnimatedTabsListProps {
  children: React.ReactNode;
  className?: string;
}

export const AnimatedTabsList: React.FC<AnimatedTabsListProps> = ({
  children,
  className,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const update = () => {
      const active = list.querySelector<HTMLElement>('[data-state="active"]');
      if (!active) return;

      const listRect = list.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();

      setIndicatorStyle({
        left: activeRect.left - listRect.left,
        width: activeRect.width,
      });
    };

    update();

    // Observe attribute changes on children to re-calculate
    const observer = new MutationObserver(update);
    observer.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] });

    const ro = new ResizeObserver(update);
    ro.observe(list);

    return () => {
      observer.disconnect();
      ro.disconnect();
    };
  }, []);

  return (
    <TabsList
      ref={listRef}
      className={cn(
        'relative flex h-10 items-center gap-1 rounded-md bg-muted p-1 text-muted-foreground',
        className
      )}
    >
      {/* Gliding underline indicator */}
      <div
        className="absolute bottom-1 h-[2px] rounded-full bg-iron transition-all"
        style={{
          ...indicatorStyle,
          transition: 'left 180ms cubic-bezier(0.16, 1, 0.3, 1), width 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
      {children}
    </TabsList>
  );
};

export { TabsContent };
