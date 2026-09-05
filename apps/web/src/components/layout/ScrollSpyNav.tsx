"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

export interface NavItem {
  id: string;
  label: string;
}

interface ScrollSpyNavProps {
  items: NavItem[];
  className?: string;
  /** Offset from the top (px) to account for sticky header + spy nav — default 104 */
  offsetTop?: number;
}

export const ScrollSpyNav: React.FC<ScrollSpyNavProps> = ({
  items,
  className,
  offsetTop = 104,
}) => {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '');
  const [scrolled, setScrolled] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Track whether user has manually scrolled (not just IntersectionObserver)
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - offsetTop;
    window.scrollTo({ top, behavior: 'smooth' });
    setActiveId(id);
  }, [offsetTop]);

  // IntersectionObserver for scroll-spy
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the topmost intersecting entry
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: `-${offsetTop}px 0px -60% 0px`,
        threshold: 0,
      }
    );

    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [items, offsetTop]);

  if (items.length === 0) return null;

  return (
    <nav
      className={cn(
        'sticky top-14 sm:top-16 z-20 transition-all duration-300',
        scrolled
          ? 'bg-background/85 backdrop-blur-xl border-b border-border/80 shadow-xs'
          : 'bg-background/60 backdrop-blur-md border-b border-border/30',
        className
      )}
      aria-label="Page sections"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Scrollable row — hides scrollbar */}
        <div className="flex items-center gap-0.5 overflow-x-auto scroll-smooth pb-px [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {items.map(({ id, label }) => {
            const isActive = activeId === id;
            return (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={cn(
                  'relative h-10 px-3 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
                aria-current={isActive ? 'location' : undefined}
              >
                {label}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
