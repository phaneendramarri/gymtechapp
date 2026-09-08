import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { fadeRiseVariants } from '@/lib/motion';

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface AppShellProps {
  /** Page title (large, prominent in the header). */
  title: string;
  /** Optional breadcrumb above the title. String is treated as a single label. */
  breadcrumb?: string | BreadcrumbItem[];
  /** Optional secondary text under the title. */
  description?: string;
  /** Right-aligned actions (buttons, tabs, etc.) shown in the page header. */
  actions?: React.ReactNode;
  /** Optional full-bleed content (skips the padded container). */
  flush?: boolean;
  children: React.ReactNode;
}

/**
 * The GymTech OS shell.
 *
 * Layout:
 *  - Left rail (64px collapsed / 224px expanded) with primary nav
 *  - Top bar: search + gym switcher + user menu
 *  - Page header: breadcrumb / title / description / actions
 *  - Body: max-w-7xl, consistent padding
 */
export const AppShell: React.FC<AppShellProps> = ({
  title,
  breadcrumb,
  description,
  actions,
  flush,
  children,
}) => {
  const location = useLocation();
  const { gym } = useAuth();
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    return localStorage.getItem('gym_rail_collapsed') === 'true';
  });
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [titleKey, setTitleKey] = React.useState(location.pathname);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('gym_rail_collapsed', String(next));
  };

  // Close mobile drawer on route change.
  React.useEffect(() => {
    setMobileOpen(false);
    setTitleKey(location.pathname);
  }, [location.pathname]);

  const crumbs: BreadcrumbItem[] = Array.isArray(breadcrumb)
    ? breadcrumb
    : breadcrumb
      ? [{ label: breadcrumb }]
      : [];

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground selection:bg-primary/20">
      <AppSidebar
        collapsed={collapsed}
        onToggleCollapsed={toggle}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader
          gymName={gym?.name || 'GymTech'}
          breadcrumbs={crumbs.length > 0 ? crumbs : undefined}
          onOpenMobileMenu={() => setMobileOpen(true)}
        />

        <main
          className={cn(
            'flex-1 min-h-0',
            flush ? 'overflow-x-auto' : ''
          )}
        >
          <div
            className={cn(
              'max-w-7xl mx-auto w-full flex flex-col',
              flush ? '' : 'px-4 sm:px-6 lg:px-8 py-6 sm:py-8'
            )}
          >
            {/* Page Header — Clean shadcn/ui title + actions row */}
            {title && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-border/60">
                <div className="min-w-0 flex-1">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.h1
                      key={titleKey}
                      variants={fadeRiseVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight truncate"
                    >
                      {title}
                    </motion.h1>
                  </AnimatePresence>
                  {description && (
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>

                {actions && (
                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                    {actions}
                  </div>
                )}
              </div>
            )}

            {/* Page Content Body */}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

